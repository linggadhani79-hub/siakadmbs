const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const today = () => new Date().toISOString().slice(0, 10);
const nowHM = () => {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

router.use(requireRole('admin', 'guru', 'musyrif'));

// Halaman scan station
router.get('/', (req, res) => {
  const terbaru = db
    .prepare(
      `SELECT a.jam, a.status, s.nama, k.nama kelas
       FROM absensi a JOIN siswa s ON s.id=a.siswa_id LEFT JOIN kelas k ON k.id=a.kelas_id
       WHERE a.tanggal=? AND a.keterangan LIKE 'Scan kartu%'
       ORDER BY a.id DESC LIMIT 10`
    )
    .all(today());
  res.render('scan/index', { title: 'Scan Kehadiran Santri', terbaru });
});

// API pencatatan scan (dipanggil via fetch dari input RFID / kamera QR)
router.post('/api', (req, res) => {
  const kode = (req.body.kartu || '').trim();
  if (!kode) return res.json({ ok: false, pesan: 'Kode kartu kosong.' });

  const siswa = db
    .prepare(
      `SELECT s.id, s.nama, s.kelas_id, k.nama kelas
       FROM siswa s LEFT JOIN kelas k ON k.id=s.kelas_id
       WHERE s.status='Aktif' AND (s.kartu_id=? OR s.nis=?)`
    )
    .get(kode, kode);
  if (!siswa) return res.json({ ok: false, pesan: `Kartu "${kode}" tidak terdaftar.` });

  const ada = db.prepare('SELECT * FROM absensi WHERE siswa_id=? AND tanggal=?').get(siswa.id, today());
  if (ada) {
    return res.json({
      ok: true, sudah: true, nama: siswa.nama, kelas: siswa.kelas || '-',
      jam: ada.jam || '-', status: ada.status,
      pesan: `${siswa.nama} sudah tercatat ${ada.status}${ada.jam ? ' pukul ' + ada.jam : ''}.`,
    });
  }

  const jam = nowHM();
  db.prepare(
    `INSERT INTO absensi (tanggal, kelas_id, siswa_id, status, keterangan, jam, dicatat_oleh)
     VALUES (?,?,?,?,?,?,?)`
  ).run(today(), siswa.kelas_id, siswa.id, 'Hadir', 'Scan kartu', jam, req.session.user.nama);

  res.json({
    ok: true, sudah: false, nama: siswa.nama, kelas: siswa.kelas || '-', jam, status: 'Hadir',
    pesan: `${siswa.nama} (${siswa.kelas || '-'}) hadir pukul ${jam}.`,
  });
});

module.exports = router;
