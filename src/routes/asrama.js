const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

router.use(requireRole('admin'));

router.get('/', (req, res) => {
  const asrama = db
    .prepare(`SELECT a.*, g.nama pembina,
              (SELECT COUNT(*) FROM kamar k WHERE k.asrama_id=a.id) jml_kamar
              FROM asrama a LEFT JOIN guru g ON g.id=a.pembina_id ORDER BY a.gender, a.nama`)
    .all();
  const kamarByAsrama = {};
  asrama.forEach((a) => {
    kamarByAsrama[a.id] = db
      .prepare(`SELECT k.*, (SELECT COUNT(*) FROM siswa s WHERE s.kamar_id=k.id AND s.status='Aktif') terisi
                FROM kamar k WHERE k.asrama_id=? ORDER BY k.nama`)
      .all(a.id);
  });
  res.render('asrama/index', {
    title: 'Asrama & Kamar',
    asrama,
    kamarByAsrama,
    guru: db.prepare('SELECT * FROM guru ORDER BY nama').all(),
  });
});

// Asrama CRUD
router.post('/', (req, res) => {
  db.prepare('INSERT INTO asrama (nama,gender,pembina_id) VALUES (?,?,?)')
    .run(req.body.nama.trim(), req.body.gender, req.body.pembina_id || null);
  flash(req, 'success', 'Asrama ditambahkan.');
  res.redirect('/asrama');
});

router.put('/:id', (req, res) => {
  db.prepare('UPDATE asrama SET nama=?,gender=?,pembina_id=? WHERE id=?')
    .run(req.body.nama.trim(), req.body.gender, req.body.pembina_id || null, req.params.id);
  flash(req, 'success', 'Asrama diperbarui.');
  res.redirect('/asrama');
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM asrama WHERE id=?').run(req.params.id);
  flash(req, 'success', 'Asrama dihapus.');
  res.redirect('/asrama');
});

// Kamar CRUD (dikelola dari halaman asrama)
router.post('/:id/kamar', (req, res) => {
  db.prepare('INSERT INTO kamar (asrama_id,nama,kapasitas) VALUES (?,?,?)')
    .run(req.params.id, req.body.nama.trim(), parseInt(req.body.kapasitas, 10) || 4);
  flash(req, 'success', 'Kamar ditambahkan.');
  res.redirect('/asrama');
});

router.delete('/kamar/:kamarId', (req, res) => {
  db.prepare('DELETE FROM kamar WHERE id=?').run(req.params.kamarId);
  flash(req, 'success', 'Kamar dihapus.');
  res.redirect('/asrama');
});

module.exports = router;
