const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

router.use(requireRole('admin'));

router.get('/', (req, res) => {
  const mapel = db.prepare('SELECT * FROM mapel ORDER BY kelompok, nama').all();
  res.render('mapel/index', { title: 'Mata Pelajaran', mapel });
});

router.get('/tambah', (req, res) => {
  res.render('mapel/form', { title: 'Tambah Mapel', mapel: {}, action: '/mapel' });
});

router.get('/:id/edit', (req, res) => {
  const mapel = db.prepare('SELECT * FROM mapel WHERE id=?').get(req.params.id);
  if (!mapel) return res.redirect('/mapel');
  res.render('mapel/form', { title: 'Edit Mapel', mapel, action: `/mapel/${mapel.id}?_method=PUT` });
});

const data = (b) => [b.kode || null, b.nama.trim(), b.kelompok || null];

router.post('/', (req, res) => {
  db.prepare('INSERT INTO mapel (kode,nama,kelompok) VALUES (?,?,?)').run(...data(req.body));
  flash(req, 'success', 'Mapel ditambahkan.');
  res.redirect('/mapel');
});

router.put('/:id', (req, res) => {
  db.prepare('UPDATE mapel SET kode=?,nama=?,kelompok=? WHERE id=?').run(...data(req.body), req.params.id);
  flash(req, 'success', 'Mapel diperbarui.');
  res.redirect('/mapel');
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM mapel WHERE id=?').run(req.params.id);
  flash(req, 'success', 'Mapel dihapus.');
  res.redirect('/mapel');
});

module.exports = router;
