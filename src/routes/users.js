const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

router.use(requireRole('admin'));

router.get('/', (req, res) => {
  const users = db.prepare('SELECT id,username,nama,role,aktif,created_at FROM users ORDER BY role, username').all();
  res.render('users/index', { title: 'Pengguna', users });
});

router.get('/tambah', (req, res) => {
  res.render('users/form', {
    title: 'Tambah Pengguna',
    user: {},
    guru: db.prepare('SELECT * FROM guru ORDER BY nama').all(),
    siswa: db.prepare("SELECT * FROM siswa WHERE status='Aktif' ORDER BY nama").all(),
    action: '/users',
  });
});

router.post('/', (req, res) => {
  const { username, password, nama, role, ref_id } = req.body;
  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username.trim());
  if (exists) {
    flash(req, 'error', 'Username sudah digunakan.');
    return res.redirect('/users/tambah');
  }
  db.prepare('INSERT INTO users (username,password_hash,nama,role,ref_id) VALUES (?,?,?,?,?)')
    .run(username.trim(), bcrypt.hashSync(password, 10), nama.trim(), role, ref_id || null);
  flash(req, 'success', 'Pengguna ditambahkan.');
  res.redirect('/users');
});

router.post('/:id/reset', (req, res) => {
  const pw = req.body.password;
  if (!pw || pw.length < 4) {
    flash(req, 'error', 'Password minimal 4 karakter.');
    return res.redirect('/users');
  }
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(pw, 10), req.params.id);
  flash(req, 'success', 'Password berhasil direset.');
  res.redirect('/users');
});

router.post('/:id/toggle', (req, res) => {
  const u = db.prepare('SELECT aktif FROM users WHERE id=?').get(req.params.id);
  db.prepare('UPDATE users SET aktif=? WHERE id=?').run(u.aktif ? 0 : 1, req.params.id);
  flash(req, 'success', 'Status pengguna diperbarui.');
  res.redirect('/users');
});

router.delete('/:id', (req, res) => {
  if (String(req.params.id) === String(req.session.user.id)) {
    flash(req, 'error', 'Tidak dapat menghapus akun sendiri.');
    return res.redirect('/users');
  }
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  flash(req, 'success', 'Pengguna dihapus.');
  res.redirect('/users');
});

module.exports = router;
