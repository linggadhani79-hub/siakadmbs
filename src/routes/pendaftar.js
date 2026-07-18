const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

router.use(requireRole('admin', 'guru', 'musyrif'));

router.get('/', (req, res) => {
  const { status, jenjang } = req.query;
  let sql = 'SELECT * FROM pendaftar WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status=?'; params.push(status); }
  if (jenjang) { sql += ' AND jenjang=?'; params.push(jenjang); }
  sql += ' ORDER BY created_at DESC, id DESC';

  const pendaftar = db.prepare(sql).all(...params);
  const ringkasan = {
    total: db.prepare('SELECT COUNT(*) c FROM pendaftar').get().c,
    baru: db.prepare("SELECT COUNT(*) c FROM pendaftar WHERE status='Baru'").get().c,
    diterima: db.prepare("SELECT COUNT(*) c FROM pendaftar WHERE status='Diterima'").get().c,
    ditolak: db.prepare("SELECT COUNT(*) c FROM pendaftar WHERE status='Ditolak'").get().c,
  };
  res.render('pendaftar/index', { title: 'PSB - Pendaftar', pendaftar, ringkasan, filter: { status, jenjang } });
});

router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM pendaftar WHERE id=?').get(req.params.id);
  if (!p) return res.redirect('/pendaftar');
  res.render('pendaftar/detail', { title: 'Detail Pendaftar', p });
});

// Terima: buat menjadi data siswa
router.post('/:id/terima', (req, res) => {
  const p = db.prepare('SELECT * FROM pendaftar WHERE id=?').get(req.params.id);
  if (!p) return res.redirect('/pendaftar');
  if (p.status === 'Diterima') {
    flash(req, 'error', 'Pendaftar sudah diterima sebelumnya.');
    return res.redirect('/pendaftar/' + p.id);
  }
  const tx = db.transaction(() => {
    const info = db.prepare(
      `INSERT INTO siswa (nama,jk,tempat_lahir,tgl_lahir,alamat,wali_ortu,no_hp,status)
       VALUES (?,?,?,?,?,?,?, 'Aktif')`
    ).run(p.nama, p.jk, p.tempat_lahir, p.tgl_lahir, p.alamat, p.nama_ortu, p.no_hp);
    db.prepare("UPDATE pendaftar SET status='Diterima', siswa_id=? WHERE id=?").run(info.lastInsertRowid, p.id);
  });
  tx();
  flash(req, 'success', `${p.nama} diterima dan ditambahkan ke data siswa. Silakan lengkapi kelas & kamar.`);
  res.redirect('/pendaftar/' + p.id);
});

router.post('/:id/tolak', (req, res) => {
  db.prepare("UPDATE pendaftar SET status='Ditolak' WHERE id=?").run(req.params.id);
  flash(req, 'success', 'Pendaftar ditandai ditolak.');
  res.redirect('/pendaftar/' + req.params.id);
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM pendaftar WHERE id=?').run(req.params.id);
  flash(req, 'success', 'Data pendaftar dihapus.');
  res.redirect('/pendaftar');
});

module.exports = router;
