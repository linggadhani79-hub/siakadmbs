const express = require('express');
const db = require('../db');
const { requireRole, staff } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };
const today = () => new Date().toISOString().slice(0, 10);

// ===== Input / lihat absensi per kelas per tanggal =====
router.get('/', (req, res) => {
  const user = req.session.user;
  const kelasList = db.prepare('SELECT * FROM kelas ORDER BY tingkat, nama').all();

  let kelasId = req.query.kelas_id;
  if (user.role === 'siswa' && user.ref_id) {
    const s = db.prepare('SELECT kelas_id FROM siswa WHERE id=?').get(user.ref_id);
    kelasId = s ? s.kelas_id : null;
  }
  if (!kelasId && kelasList.length) kelasId = kelasList[0].id;
  const tanggal = req.query.tanggal || today();

  let siswa = [];
  if (kelasId) {
    siswa = db
      .prepare(
        `SELECT s.id, s.nama, s.nis, a.status, a.keterangan
         FROM siswa s
         LEFT JOIN absensi a ON a.siswa_id=s.id AND a.tanggal=?
         WHERE s.kelas_id=? AND s.status='Aktif'
         ORDER BY s.nama`
      )
      .all(tanggal, kelasId);
  }

  const rekap = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0, belum: 0 };
  siswa.forEach((s) => { if (s.status) rekap[s.status]++; else rekap.belum++; });

  res.render('absensi/index', {
    title: 'Absensi Harian',
    kelasList,
    kelasId: kelasId ? Number(kelasId) : null,
    kelas: kelasId ? db.prepare('SELECT * FROM kelas WHERE id=?').get(kelasId) : null,
    tanggal, siswa, rekap,
    canManage: staff.includes(user.role),
  });
});

router.post('/', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  const { kelas_id, tanggal } = req.body;
  const statuses = req.body.status || {};
  const keterangan = req.body.keterangan || {};
  const nama = req.session.user.nama;

  const up = db.prepare(
    `INSERT INTO absensi (tanggal,kelas_id,siswa_id,status,keterangan,dicatat_oleh)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(tanggal,siswa_id) DO UPDATE SET status=excluded.status, keterangan=excluded.keterangan, dicatat_oleh=excluded.dicatat_oleh`
  );
  const tx = db.transaction(() => {
    Object.keys(statuses).forEach((key) => {
      const sid = key.replace(/^s/, ''); // kunci berbentuk s<id>
      up.run(tanggal, kelas_id, sid, statuses[key], keterangan[key] || null, nama);
    });
  });
  tx();
  flash(req, 'success', 'Absensi berhasil disimpan.');
  res.redirect(`/absensi?kelas_id=${kelas_id}&tanggal=${tanggal}`);
});

// ===== Rekap per siswa (rentang) =====
router.get('/rekap', (req, res) => {
  const user = req.session.user;
  const kelasList = db.prepare('SELECT * FROM kelas ORDER BY tingkat, nama').all();
  let kelasId = req.query.kelas_id;
  if (user.role === 'siswa' && user.ref_id) {
    const s = db.prepare('SELECT kelas_id FROM siswa WHERE id=?').get(user.ref_id);
    kelasId = s ? s.kelas_id : null;
  }
  if (!kelasId && kelasList.length) kelasId = kelasList[0].id;
  const bulan = req.query.bulan || today().slice(0, 7); // YYYY-MM

  let rekap = [];
  if (kelasId) {
    rekap = db
      .prepare(
        `SELECT s.id, s.nama,
          SUM(CASE WHEN a.status='Hadir' THEN 1 ELSE 0 END) hadir,
          SUM(CASE WHEN a.status='Sakit' THEN 1 ELSE 0 END) sakit,
          SUM(CASE WHEN a.status='Izin' THEN 1 ELSE 0 END) izin,
          SUM(CASE WHEN a.status='Alpa' THEN 1 ELSE 0 END) alpa
         FROM siswa s
         LEFT JOIN absensi a ON a.siswa_id=s.id AND substr(a.tanggal,1,7)=?
         WHERE s.kelas_id=? AND s.status='Aktif'
         GROUP BY s.id ORDER BY s.nama`
      )
      .all(bulan, kelasId);
  }

  res.render('absensi/rekap', {
    title: 'Rekap Absensi',
    kelasList,
    kelasId: kelasId ? Number(kelasId) : null,
    kelas: kelasId ? db.prepare('SELECT * FROM kelas WHERE id=?').get(kelasId) : null,
    bulan, rekap,
    lockKelas: user.role === 'siswa',
  });
});

module.exports = router;
