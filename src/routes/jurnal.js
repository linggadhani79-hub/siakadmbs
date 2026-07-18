const express = require('express');
const db = require('../db');
const { requireRole, staff } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

router.get('/', (req, res) => {
  const user = req.session.user;
  const { kelas_id, guru_id, tanggal } = req.query;

  let sql = `SELECT j.*, g.nama guru, k.nama kelas, m.nama mapel
             FROM jurnal j
             JOIN guru g ON g.id=j.guru_id
             JOIN kelas k ON k.id=j.kelas_id
             JOIN mapel m ON m.id=j.mapel_id WHERE 1=1`;
  const params = [];

  // Guru/musyrif hanya lihat jurnal miliknya, admin lihat semua
  if ((user.role === 'guru' || user.role === 'musyrif') && user.ref_id) {
    sql += ' AND j.guru_id = ?'; params.push(user.ref_id);
  } else if (user.role === 'siswa' && user.ref_id) {
    const s = db.prepare('SELECT kelas_id FROM siswa WHERE id=?').get(user.ref_id);
    sql += ' AND j.kelas_id = ?'; params.push(s ? s.kelas_id : 0);
  } else {
    if (guru_id) { sql += ' AND j.guru_id = ?'; params.push(guru_id); }
  }
  if (kelas_id) { sql += ' AND j.kelas_id = ?'; params.push(kelas_id); }
  if (tanggal) { sql += ' AND j.tanggal = ?'; params.push(tanggal); }
  sql += ' ORDER BY j.tanggal DESC, j.id DESC';

  const jurnal = db.prepare(sql).all(...params);
  res.render('jurnal/index', {
    title: 'Jurnal Mengajar',
    jurnal,
    kelas: db.prepare('SELECT * FROM kelas ORDER BY tingkat, nama').all(),
    guru: db.prepare('SELECT * FROM guru ORDER BY nama').all(),
    filter: { kelas_id, guru_id, tanggal },
    canManage: staff.includes(user.role),
  });
});

router.get('/tambah', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  res.render('jurnal/form', {
    title: 'Tambah Jurnal',
    jurnal: { tanggal: new Date().toISOString().slice(0, 10) },
    kelas: db.prepare('SELECT * FROM kelas ORDER BY tingkat, nama').all(),
    guru: db.prepare('SELECT * FROM guru ORDER BY nama').all(),
    mapel: db.prepare('SELECT * FROM mapel ORDER BY kelompok, nama').all(),
    action: '/jurnal',
    user: req.session.user,
  });
});

router.get('/:id/edit', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  const jurnal = db.prepare('SELECT * FROM jurnal WHERE id=?').get(req.params.id);
  if (!jurnal) return res.redirect('/jurnal');
  res.render('jurnal/form', {
    title: 'Edit Jurnal',
    jurnal,
    kelas: db.prepare('SELECT * FROM kelas ORDER BY tingkat, nama').all(),
    guru: db.prepare('SELECT * FROM guru ORDER BY nama').all(),
    mapel: db.prepare('SELECT * FROM mapel ORDER BY kelompok, nama').all(),
    action: `/jurnal/${jurnal.id}?_method=PUT`,
    user: req.session.user,
  });
});

const data = (b) => [
  b.tanggal, b.jam_ke || null, b.guru_id, b.kelas_id, b.mapel_id,
  b.materi.trim(), b.metode || null,
  parseInt(b.kehadiran, 10) || 0, parseInt(b.total_siswa, 10) || 0, b.catatan || null,
];

router.post('/', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  db.prepare(
    `INSERT INTO jurnal (tanggal,jam_ke,guru_id,kelas_id,mapel_id,materi,metode,kehadiran,total_siswa,catatan)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(...data(req.body));
  flash(req, 'success', 'Jurnal mengajar berhasil dicatat.');
  res.redirect('/jurnal');
});

router.put('/:id', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  db.prepare(
    `UPDATE jurnal SET tanggal=?,jam_ke=?,guru_id=?,kelas_id=?,mapel_id=?,materi=?,metode=?,kehadiran=?,total_siswa=?,catatan=? WHERE id=?`
  ).run(...data(req.body), req.params.id);
  flash(req, 'success', 'Jurnal diperbarui.');
  res.redirect('/jurnal');
});

router.delete('/:id', requireRole('admin', 'guru', 'musyrif'), (req, res) => {
  db.prepare('DELETE FROM jurnal WHERE id=?').run(req.params.id);
  flash(req, 'success', 'Jurnal dihapus.');
  res.redirect('/jurnal');
});

module.exports = router;
