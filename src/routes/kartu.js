const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

router.use(requireRole('admin', 'guru', 'musyrif'));

// ===== Kelola kartu siswa =====
router.get('/', (req, res) => {
  const { kelas_id } = req.query;
  let sql = `SELECT s.id, s.nis, s.nama, s.kartu_id, k.nama kelas
             FROM siswa s LEFT JOIN kelas k ON k.id=s.kelas_id
             WHERE s.status='Aktif'`;
  const params = [];
  if (kelas_id) { sql += ' AND s.kelas_id=?'; params.push(kelas_id); }
  sql += ' ORDER BY k.tingkat, k.nama, s.nama';
  const siswa = db.prepare(sql).all(...params);
  const kelas = db.prepare('SELECT * FROM kelas ORDER BY tingkat, nama').all();
  res.render('kartu/index', { title: 'Kartu Siswa (QR / RFID)', siswa, kelas, filter: { kelas_id } });
});

// Set / registrasi ID kartu (ketik manual atau tempel dari pembaca RFID)
router.post('/set', requireRole('admin'), (req, res) => {
  const { siswa_id, kartu_id } = req.body;
  const val = (kartu_id || '').trim() || null;
  if (val) {
    const dupe = db.prepare('SELECT id, nama FROM siswa WHERE kartu_id=? AND id!=?').get(val, siswa_id);
    if (dupe) {
      flash(req, 'error', `ID kartu "${val}" sudah dipakai oleh ${dupe.nama}.`);
      return res.redirect('/kartu');
    }
  }
  db.prepare('UPDATE siswa SET kartu_id=? WHERE id=?').run(val, siswa_id);
  flash(req, 'success', val ? 'ID kartu tersimpan.' : 'ID kartu dihapus.');
  res.redirect('/kartu' + (req.body.kelas_id ? '?kelas_id=' + req.body.kelas_id : ''));
});

// Generate otomatis untuk yang belum punya kartu
router.post('/generate', requireRole('admin'), (req, res) => {
  const kosong = db.prepare("SELECT id, nis FROM siswa WHERE status='Aktif' AND (kartu_id IS NULL OR kartu_id='')").all();
  const tahun = new Date().getFullYear();
  const tx = db.transaction(() => {
    kosong.forEach((s) => {
      const id = 'MBS' + tahun + String(s.id).padStart(4, '0');
      db.prepare('UPDATE siswa SET kartu_id=? WHERE id=?').run(id, s.id);
    });
  });
  tx();
  flash(req, 'success', `${kosong.length} kartu digenerate otomatis.`);
  res.redirect('/kartu');
});

// ===== Cetak kartu (grid kartu ber-QR) =====
router.get('/cetak', async (req, res) => {
  const { kelas_id } = req.query;
  let sql = `SELECT s.id, s.nis, s.nama, s.jk, s.kartu_id, k.nama kelas, k.jenjang
             FROM siswa s LEFT JOIN kelas k ON k.id=s.kelas_id
             WHERE s.status='Aktif' AND s.kartu_id IS NOT NULL`;
  const params = [];
  if (kelas_id) { sql += ' AND s.kelas_id=?'; params.push(kelas_id); }
  sql += ' ORDER BY k.tingkat, k.nama, s.nama';
  const siswa = db.prepare(sql).all(...params);
  const kartu = await Promise.all(
    siswa.map(async (s) => ({
      ...s,
      qr: await QRCode.toDataURL(s.kartu_id, { margin: 1, width: 220, color: { dark: '#0c3d2c' } }),
    }))
  );
  res.render('kartu/cetak', { kartu });
});

module.exports = router;
