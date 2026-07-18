const express = require('express');
const db = require('../db');

const router = express.Router();

// ===== Landing / Profil Sekolah =====
router.get('/', (req, res) => {
  const stats = {
    santri: db.prepare("SELECT COUNT(*) c FROM siswa WHERE status='Aktif'").get().c,
    guru: db.prepare('SELECT COUNT(*) c FROM guru WHERE aktif=1').get().c,
    kelas: db.prepare('SELECT COUNT(*) c FROM kelas').get().c,
    pendaftar: db.prepare('SELECT COUNT(*) c FROM pendaftar').get().c,
  };
  res.render('public/landing', {
    title: 'Beranda',
    stats,
    user: req.session.user || null,
  });
});

// ===== PSB: Form Pendaftaran =====
router.get('/psb', (req, res) => {
  res.render('public/psb-form', { title: 'PSB - Pendaftaran Santri Baru', error: null, form: {}, user: req.session.user || null });
});

router.post('/psb', (req, res) => {
  const b = req.body;
  if (!b.nama || !b.jk || !b.jenjang) {
    return res.render('public/psb-form', {
      title: 'PSB - Pendaftaran Santri Baru',
      error: 'Nama, jenis kelamin, dan jenjang wajib diisi.',
      form: b,
      user: req.session.user || null,
    });
  }
  const year = new Date().getFullYear();
  const seq = db.prepare('SELECT COUNT(*) c FROM pendaftar').get().c + 1;
  const noReg = `PSB${year}${String(seq).padStart(4, '0')}`;

  db.prepare(
    `INSERT INTO pendaftar (no_reg,nama,jk,jenjang,tempat_lahir,tgl_lahir,asal_sekolah,alamat,nama_ortu,no_hp,email,catatan)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    noReg, b.nama.trim(), b.jk, b.jenjang, b.tempat_lahir || null, b.tgl_lahir || null,
    b.asal_sekolah || null, b.alamat || null, b.nama_ortu || null, b.no_hp || null,
    b.email || null, b.catatan || null
  );

  res.redirect('/psb/sukses?reg=' + encodeURIComponent(noReg));
});

router.get('/psb/sukses', (req, res) => {
  const pendaftar = db.prepare('SELECT * FROM pendaftar WHERE no_reg=?').get(req.query.reg || '');
  if (!pendaftar) return res.redirect('/psb');
  res.render('public/psb-sukses', { title: 'Pendaftaran Berhasil', pendaftar, user: req.session.user || null });
});

// ===== Cek status pendaftaran =====
router.get('/psb/cek', (req, res) => {
  let pendaftar = null;
  let notFound = false;
  if (req.query.reg) {
    pendaftar = db.prepare('SELECT * FROM pendaftar WHERE no_reg=?').get(req.query.reg.trim());
    notFound = !pendaftar;
  }
  res.render('public/psb-cek', { title: 'Cek Status PSB', pendaftar, notFound, reg: req.query.reg || '', user: req.session.user || null });
});

module.exports = router;
