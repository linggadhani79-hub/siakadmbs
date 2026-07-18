const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };
const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function buildGrid(kelasId) {
  const rows = db
    .prepare(
      `SELECT j.*, m.nama mapel, g.nama guru
       FROM jadwal j
       JOIN mapel m ON m.id=j.mapel_id
       LEFT JOIN guru g ON g.id=j.guru_id
       WHERE j.kelas_id=?
       ORDER BY j.jam_mulai`
    )
    .all(kelasId);
  const grid = {};
  HARI.forEach((h) => (grid[h] = []));
  rows.forEach((r) => grid[r.hari].push(r));
  return grid;
}

router.get('/', (req, res) => {
  const user = req.session.user;
  const kelasList = db.prepare('SELECT * FROM kelas ORDER BY tingkat, nama').all();

  // Tentukan kelas terpilih
  let kelasId = req.query.kelas_id;
  if (user.role === 'siswa' && user.ref_id) {
    const s = db.prepare('SELECT kelas_id FROM siswa WHERE id=?').get(user.ref_id);
    kelasId = s ? s.kelas_id : null;
  }
  if (!kelasId && kelasList.length) kelasId = kelasList[0].id;

  const kelas = kelasId ? db.prepare('SELECT * FROM kelas WHERE id=?').get(kelasId) : null;
  const grid = kelasId ? buildGrid(kelasId) : {};

  // Jadwal mengajar guru (khusus guru/musyrif)
  let jadwalGuru = null;
  if ((user.role === 'guru' || user.role === 'musyrif') && user.ref_id) {
    jadwalGuru = db
      .prepare(
        `SELECT j.*, m.nama mapel, k.nama kelas
         FROM jadwal j JOIN mapel m ON m.id=j.mapel_id JOIN kelas k ON k.id=j.kelas_id
         WHERE j.guru_id=? ORDER BY
           CASE j.hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3
                       WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 ELSE 6 END, j.jam_mulai`
      )
      .all(user.ref_id);
  }

  res.render('jadwal/index', {
    title: 'Jadwal Pelajaran',
    kelasList, kelas, grid, HARI, jadwalGuru,
    canManage: user.role === 'admin',
    lockKelas: user.role === 'siswa',
  });
});

router.get('/kelola/:kelasId', requireRole('admin'), (req, res) => {
  const kelas = db.prepare('SELECT * FROM kelas WHERE id=?').get(req.params.kelasId);
  if (!kelas) return res.redirect('/jadwal');
  const list = db
    .prepare(
      `SELECT j.*, m.nama mapel, g.nama guru
       FROM jadwal j JOIN mapel m ON m.id=j.mapel_id LEFT JOIN guru g ON g.id=j.guru_id
       WHERE j.kelas_id=? ORDER BY
         CASE j.hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3
                     WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 ELSE 6 END, j.jam_mulai`
    )
    .all(req.params.kelasId);
  res.render('jadwal/kelola', {
    title: `Kelola Jadwal ${kelas.nama}`,
    kelas, list, HARI,
    mapel: db.prepare('SELECT * FROM mapel ORDER BY nama').all(),
    guru: db.prepare('SELECT * FROM guru ORDER BY nama').all(),
  });
});

router.post('/kelola/:kelasId', requireRole('admin'), (req, res) => {
  const b = req.body;
  db.prepare(
    'INSERT INTO jadwal (kelas_id,hari,jam_mulai,jam_selesai,mapel_id,guru_id) VALUES (?,?,?,?,?,?)'
  ).run(req.params.kelasId, b.hari, b.jam_mulai, b.jam_selesai, b.mapel_id, b.guru_id || null);
  flash(req, 'success', 'Jadwal ditambahkan.');
  res.redirect('/jadwal/kelola/' + req.params.kelasId);
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const j = db.prepare('SELECT kelas_id FROM jadwal WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM jadwal WHERE id=?').run(req.params.id);
  flash(req, 'success', 'Jadwal dihapus.');
  res.redirect('/jadwal/kelola/' + (j ? j.kelas_id : ''));
});

module.exports = router;
