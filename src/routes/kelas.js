const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

router.use(requireRole('admin'));

router.get('/', (req, res) => {
  const kelas = db
    .prepare(`SELECT k.*, g.nama wali,
              (SELECT COUNT(*) FROM siswa s WHERE s.kelas_id=k.id AND s.status='Aktif') jml
              FROM kelas k LEFT JOIN guru g ON g.id=k.wali_id ORDER BY k.tingkat, k.nama`)
    .all();
  res.render('kelas/index', { title: 'Kelas', kelas });
});

router.get('/tambah', (req, res) => {
  res.render('kelas/form', { title: 'Tambah Kelas', kelas: {}, guru: db.prepare('SELECT * FROM guru ORDER BY nama').all(), action: '/kelas' });
});

router.get('/:id/edit', (req, res) => {
  const kelas = db.prepare('SELECT * FROM kelas WHERE id=?').get(req.params.id);
  if (!kelas) return res.redirect('/kelas');
  res.render('kelas/form', { title: 'Edit Kelas', kelas, guru: db.prepare('SELECT * FROM guru ORDER BY nama').all(), action: `/kelas/${kelas.id}?_method=PUT` });
});

const data = (b) => [b.nama.trim(), b.jenjang, parseInt(b.tingkat, 10), b.wali_id || null];

router.post('/', (req, res) => {
  db.prepare('INSERT INTO kelas (nama,jenjang,tingkat,wali_id) VALUES (?,?,?,?)').run(...data(req.body));
  flash(req, 'success', 'Kelas ditambahkan.');
  res.redirect('/kelas');
});

router.put('/:id', (req, res) => {
  db.prepare('UPDATE kelas SET nama=?,jenjang=?,tingkat=?,wali_id=? WHERE id=?').run(...data(req.body), req.params.id);
  flash(req, 'success', 'Kelas diperbarui.');
  res.redirect('/kelas');
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM kelas WHERE id=?').run(req.params.id);
  flash(req, 'success', 'Kelas dihapus.');
  res.redirect('/kelas');
});

module.exports = router;
