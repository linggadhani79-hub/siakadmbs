const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function flash(req, type, msg) {
  req.session.flash = { type, msg };
}

router.get('/', (req, res) => {
  const { kelas_id, q } = req.query;
  let sql = `SELECT s.*, k.nama kelas_nama, km.nama kamar_nama
             FROM siswa s
             LEFT JOIN kelas k ON k.id=s.kelas_id
             LEFT JOIN kamar km ON km.id=s.kamar_id
             WHERE s.status='Aktif'`;
  const params = [];
  if (kelas_id) { sql += ' AND s.kelas_id = ?'; params.push(kelas_id); }
  if (q) { sql += ' AND (s.nama LIKE ? OR s.nis LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY k.tingkat, k.nama, s.nama';

  const siswa = db.prepare(sql).all(...params);
  const kelas = db.prepare('SELECT * FROM kelas ORDER BY tingkat, nama').all();

  res.render('siswa/index', { title: 'Data Siswa', siswa, kelas, filter: { kelas_id, q } });
});

router.get('/tambah', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  res.render('siswa/form', {
    title: 'Tambah Siswa',
    siswa: {},
    kelas: db.prepare('SELECT * FROM kelas ORDER BY tingkat, nama').all(),
    kamar: db.prepare('SELECT km.*, a.nama asrama, a.gender FROM kamar km JOIN asrama a ON a.id=km.asrama_id ORDER BY a.nama, km.nama').all(),
    action: '/siswa',
  });
});

router.get('/:id', (req, res) => {
  const siswa = db
    .prepare(`SELECT s.*, k.nama kelas_nama, km.nama kamar_nama, a.nama asrama_nama
              FROM siswa s
              LEFT JOIN kelas k ON k.id=s.kelas_id
              LEFT JOIN kamar km ON km.id=s.kamar_id
              LEFT JOIN asrama a ON a.id=km.asrama_id
              WHERE s.id=?`)
    .get(req.params.id);
  if (!siswa) return res.redirect('/siswa');

  const tahfidz = db
    .prepare(`SELECT t.*, g.nama musyrif FROM tahfidz t LEFT JOIN guru g ON g.id=t.musyrif_id
              WHERE t.siswa_id=? ORDER BY t.tanggal DESC, t.id DESC`)
    .all(req.params.id);
  const ziyadah = tahfidz.filter((t) => t.jenis === 'Ziyadah').length;
  const juzTertinggi = db
    .prepare("SELECT MAX(juz) m FROM tahfidz WHERE siswa_id=? AND jenis='Ziyadah'")
    .get(req.params.id).m;

  res.render('siswa/detail', { title: 'Detail Siswa', siswa, tahfidz, ziyadah, juzTertinggi });
});

router.get('/:id/edit', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  const siswa = db.prepare('SELECT * FROM siswa WHERE id=?').get(req.params.id);
  if (!siswa) return res.redirect('/siswa');
  res.render('siswa/form', {
    title: 'Edit Siswa',
    siswa,
    kelas: db.prepare('SELECT * FROM kelas ORDER BY tingkat, nama').all(),
    kamar: db.prepare('SELECT km.*, a.nama asrama, a.gender FROM kamar km JOIN asrama a ON a.id=km.asrama_id ORDER BY a.nama, km.nama').all(),
    action: `/siswa/${siswa.id}?_method=PUT`,
  });
});

function payload(b) {
  return [
    b.nis || null, b.nama.trim(), b.jk, b.tempat_lahir || null, b.tgl_lahir || null,
    b.alamat || null, b.wali_ortu || null, b.no_hp || null,
    b.kelas_id || null, b.kamar_id || null,
  ];
}

router.post('/', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  db.prepare(
    `INSERT INTO siswa (nis,nama,jk,tempat_lahir,tgl_lahir,alamat,wali_ortu,no_hp,kelas_id,kamar_id)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(...payload(req.body));
  flash(req, 'success', 'Data siswa berhasil ditambahkan.');
  res.redirect('/siswa');
});

router.put('/:id', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  db.prepare(
    `UPDATE siswa SET nis=?,nama=?,jk=?,tempat_lahir=?,tgl_lahir=?,alamat=?,wali_ortu=?,no_hp=?,kelas_id=?,kamar_id=? WHERE id=?`
  ).run(...payload(req.body), req.params.id);
  flash(req, 'success', 'Data siswa berhasil diperbarui.');
  res.redirect('/siswa');
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM siswa WHERE id=?').run(req.params.id);
  flash(req, 'success', 'Data siswa dihapus.');
  res.redirect('/siswa');
});

module.exports = router;
