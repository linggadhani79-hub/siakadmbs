const express = require('express');
const db = require('../db');
const { requireRole, staff } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

router.get('/', (req, res) => {
  const user = req.session.user;
  const { siswa_id, jenis, nilai, kelas_id } = req.query;

  let sql = `SELECT t.*, s.nama siswa, k.nama kelas, g.nama musyrif
             FROM tahfidz t
             JOIN siswa s ON s.id=t.siswa_id
             LEFT JOIN kelas k ON k.id=s.kelas_id
             LEFT JOIN guru g ON g.id=t.musyrif_id WHERE 1=1`;
  const params = [];

  if (user.role === 'siswa' && user.ref_id) {
    sql += ' AND t.siswa_id = ?'; params.push(user.ref_id);
  } else {
    if (siswa_id) { sql += ' AND t.siswa_id = ?'; params.push(siswa_id); }
    if (kelas_id) { sql += ' AND s.kelas_id = ?'; params.push(kelas_id); }
  }
  if (jenis) { sql += ' AND t.jenis = ?'; params.push(jenis); }
  if (nilai) { sql += ' AND t.nilai = ?'; params.push(nilai); }
  sql += ' ORDER BY t.tanggal DESC, t.id DESC';

  const tahfidz = db.prepare(sql).all(...params);

  const ringkasan = {
    totalSetoran: tahfidz.length,
    ziyadah: tahfidz.filter((t) => t.jenis === 'Ziyadah').length,
    murojaah: tahfidz.filter((t) => t.jenis === 'Murojaah').length,
    mumtaz: tahfidz.filter((t) => t.nilai === 'Mumtaz').length,
  };

  res.render('tahfidz/index', {
    title: 'Manajemen Tahfidz Quran',
    tahfidz,
    ringkasan,
    siswa: db.prepare("SELECT * FROM siswa WHERE status='Aktif' ORDER BY nama").all(),
    kelas: db.prepare('SELECT * FROM kelas ORDER BY tingkat, nama').all(),
    filter: { siswa_id, jenis, nilai, kelas_id },
    canManage: staff.includes(user.role),
  });
});

// Rekap capaian per santri
router.get('/rekap', (req, res) => {
  const rekap = db
    .prepare(`SELECT s.id, s.nama, k.nama kelas,
                (SELECT COUNT(*) FROM tahfidz t WHERE t.siswa_id=s.id AND t.jenis='Ziyadah') ziyadah,
                (SELECT COUNT(*) FROM tahfidz t WHERE t.siswa_id=s.id AND t.jenis='Murojaah') murojaah,
                (SELECT MAX(juz) FROM tahfidz t WHERE t.siswa_id=s.id AND t.jenis='Ziyadah') juz_tertinggi,
                (SELECT MAX(tanggal) FROM tahfidz t WHERE t.siswa_id=s.id) terakhir
              FROM siswa s LEFT JOIN kelas k ON k.id=s.kelas_id
              WHERE s.status='Aktif' ORDER BY juz_tertinggi DESC, ziyadah DESC`)
    .all();
  res.render('tahfidz/rekap', { title: 'Rekap Capaian Tahfidz', rekap });
});

router.get('/tambah', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  res.render('tahfidz/form', {
    title: 'Input Setoran Tahfidz',
    t: { tanggal: new Date().toISOString().slice(0, 10), siswa_id: req.query.siswa_id || '' },
    siswa: db.prepare("SELECT * FROM siswa WHERE status='Aktif' ORDER BY nama").all(),
    musyrif: db.prepare('SELECT * FROM guru ORDER BY nama').all(),
    action: '/tahfidz',
    user: req.session.user,
  });
});

router.get('/:id/edit', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  const t = db.prepare('SELECT * FROM tahfidz WHERE id=?').get(req.params.id);
  if (!t) return res.redirect('/tahfidz');
  res.render('tahfidz/form', {
    title: 'Edit Setoran Tahfidz',
    t,
    siswa: db.prepare("SELECT * FROM siswa WHERE status='Aktif' ORDER BY nama").all(),
    musyrif: db.prepare('SELECT * FROM guru ORDER BY nama').all(),
    action: `/tahfidz/${t.id}?_method=PUT`,
    user: req.session.user,
  });
});

const data = (b) => [
  b.tanggal, b.siswa_id, b.musyrif_id || null, b.jenis,
  parseInt(b.juz, 10) || null, b.surah.trim(),
  parseInt(b.ayat_dari, 10) || null, parseInt(b.ayat_sampai, 10) || null,
  b.nilai || null, b.catatan || null,
];

router.post('/', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  db.prepare(
    `INSERT INTO tahfidz (tanggal,siswa_id,musyrif_id,jenis,juz,surah,ayat_dari,ayat_sampai,nilai,catatan)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(...data(req.body));
  flash(req, 'success', 'Setoran tahfidz berhasil dicatat.');
  res.redirect('/tahfidz');
});

router.put('/:id', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  db.prepare(
    `UPDATE tahfidz SET tanggal=?,siswa_id=?,musyrif_id=?,jenis=?,juz=?,surah=?,ayat_dari=?,ayat_sampai=?,nilai=?,catatan=? WHERE id=?`
  ).run(...data(req.body), req.params.id);
  flash(req, 'success', 'Setoran diperbarui.');
  res.redirect('/tahfidz');
});

router.delete('/:id', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  db.prepare('DELETE FROM tahfidz WHERE id=?').run(req.params.id);
  flash(req, 'success', 'Setoran dihapus.');
  res.redirect('/tahfidz');
});

module.exports = router;
