const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

router.use(requireRole('admin'));

router.get('/', (req, res) => {
  const berita = db.prepare('SELECT * FROM berita ORDER BY created_at DESC, id DESC').all();
  res.render('berita/index', { title: 'Berita & Pengumuman', berita });
});

router.get('/tambah', (req, res) => {
  res.render('berita/form', { title: 'Tulis Berita', b: { publish: 1 }, action: '/kelola-berita' });
});

router.get('/:id/edit', (req, res) => {
  const b = db.prepare('SELECT * FROM berita WHERE id=?').get(req.params.id);
  if (!b) return res.redirect('/kelola-berita');
  res.render('berita/form', { title: 'Edit Berita', b, action: `/kelola-berita/${b.id}?_method=PUT` });
});

const data = (body) => [
  body.judul.trim(), body.kategori, body.ringkasan || null, body.isi.trim(),
  body.gambar || null, body.penulis || null, body.publish ? 1 : 0,
];

router.post('/', (req, res) => {
  db.prepare(
    'INSERT INTO berita (judul,kategori,ringkasan,isi,gambar,penulis,publish) VALUES (?,?,?,?,?,?,?)'
  ).run(...data(req.body));
  flash(req, 'success', 'Berita berhasil diterbitkan.');
  res.redirect('/kelola-berita');
});

router.put('/:id', (req, res) => {
  db.prepare(
    'UPDATE berita SET judul=?,kategori=?,ringkasan=?,isi=?,gambar=?,penulis=?,publish=? WHERE id=?'
  ).run(...data(req.body), req.params.id);
  flash(req, 'success', 'Berita diperbarui.');
  res.redirect('/kelola-berita');
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM berita WHERE id=?').run(req.params.id);
  flash(req, 'success', 'Berita dihapus.');
  res.redirect('/kelola-berita');
});

module.exports = router;
