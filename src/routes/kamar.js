const express = require('express');
const db = require('../db');
const { requireRole, staff } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

router.get('/', (req, res) => {
  const asrama = db
    .prepare(`SELECT a.*, g.nama pembina FROM asrama a LEFT JOIN guru g ON g.id=a.pembina_id ORDER BY a.gender, a.nama`)
    .all();

  const kamarData = asrama.map((a) => {
    const kamar = db
      .prepare(`SELECT k.* FROM kamar k WHERE k.asrama_id=? ORDER BY k.nama`)
      .all(a.id)
      .map((k) => {
        const penghuni = db
          .prepare(`SELECT s.id, s.nama, kl.nama kelas FROM siswa s LEFT JOIN kelas kl ON kl.id=s.kelas_id
                    WHERE s.kamar_id=? AND s.status='Aktif' ORDER BY s.nama`)
          .all(k.id);
        return { ...k, penghuni };
      });
    return { ...a, kamar };
  });

  // Santri belum ditempatkan (sesuai gender ditangani di form)
  const belumDitempatkan = db
    .prepare(`SELECT s.id, s.nama, s.jk, kl.nama kelas FROM siswa s LEFT JOIN kelas kl ON kl.id=s.kelas_id
              WHERE s.kamar_id IS NULL AND s.status='Aktif' ORDER BY s.nama`)
    .all();

  res.render('kamar/index', {
    title: 'Pembagian Kamar Asrama',
    kamarData,
    belumDitempatkan,
    canManage: staff.includes(req.session.user.role),
  });
});

// Tempatkan / pindahkan santri ke kamar
router.post('/tempatkan', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  const { siswa_id, kamar_id } = req.body;
  const kamar = db.prepare('SELECT * FROM kamar WHERE id=?').get(kamar_id);
  if (!kamar) { flash(req, 'error', 'Kamar tidak ditemukan.'); return res.redirect('/kamar'); }

  const terisi = db
    .prepare("SELECT COUNT(*) c FROM siswa WHERE kamar_id=? AND status='Aktif'")
    .get(kamar_id).c;
  if (terisi >= kamar.kapasitas) {
    flash(req, 'error', `Kamar ${kamar.nama} sudah penuh (kapasitas ${kamar.kapasitas}).`);
    return res.redirect('/kamar');
  }

  // Validasi gender santri vs asrama
  const siswa = db.prepare('SELECT jk FROM siswa WHERE id=?').get(siswa_id);
  const asrama = db.prepare('SELECT gender FROM asrama WHERE id=?').get(kamar.asrama_id);
  const cocok = (siswa.jk === 'L' && asrama.gender === 'Putra') || (siswa.jk === 'P' && asrama.gender === 'Putri');
  if (!cocok) {
    flash(req, 'error', 'Gender santri tidak sesuai dengan asrama.');
    return res.redirect('/kamar');
  }

  db.prepare('UPDATE siswa SET kamar_id=? WHERE id=?').run(kamar_id, siswa_id);
  flash(req, 'success', 'Santri berhasil ditempatkan.');
  res.redirect('/kamar');
});

// Keluarkan santri dari kamar
router.post('/keluarkan', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  db.prepare('UPDATE siswa SET kamar_id=NULL WHERE id=?').run(req.body.siswa_id);
  flash(req, 'success', 'Santri dikeluarkan dari kamar.');
  res.redirect('/kamar');
});

module.exports = router;
