const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

router.use(requireRole('admin'));

router.get('/', (req, res) => {
  const guru = db.prepare('SELECT * FROM guru ORDER BY nama').all();
  res.render('guru/index', { title: 'Guru & Musyrif', guru });
});

router.get('/tambah', (req, res) => {
  res.render('guru/form', { title: 'Tambah Guru', guru: {}, action: '/guru' });
});

router.get('/:id/edit', (req, res) => {
  const guru = db.prepare('SELECT * FROM guru WHERE id=?').get(req.params.id);
  if (!guru) return res.redirect('/guru');
  res.render('guru/form', { title: 'Edit Guru', guru, action: `/guru/${guru.id}?_method=PUT` });
});

const data = (b) => [b.nip || null, b.nama.trim(), b.jk || null, b.no_hp || null, b.jabatan || null];

router.post('/', (req, res) => {
  db.prepare('INSERT INTO guru (nip,nama,jk,no_hp,jabatan) VALUES (?,?,?,?,?)').run(...data(req.body));
  flash(req, 'success', 'Guru berhasil ditambahkan.');
  res.redirect('/guru');
});

router.put('/:id', (req, res) => {
  db.prepare('UPDATE guru SET nip=?,nama=?,jk=?,no_hp=?,jabatan=? WHERE id=?').run(...data(req.body), req.params.id);
  flash(req, 'success', 'Data guru diperbarui.');
  res.redirect('/guru');
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM guru WHERE id=?').run(req.params.id);
  flash(req, 'success', 'Guru dihapus.');
  res.redirect('/guru');
});

module.exports = router;
