const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const user = req.session.user;

  const stats = {
    siswa: db.prepare("SELECT COUNT(*) c FROM siswa WHERE status='Aktif'").get().c,
    guru: db.prepare('SELECT COUNT(*) c FROM guru WHERE aktif=1').get().c,
    kelas: db.prepare('SELECT COUNT(*) c FROM kelas').get().c,
    kamar: db.prepare('SELECT COUNT(*) c FROM kamar').get().c,
    jurnalHariIni: db
      .prepare("SELECT COUNT(*) c FROM jurnal WHERE tanggal = date('now','localtime')")
      .get().c,
    setoranHariIni: db
      .prepare("SELECT COUNT(*) c FROM tahfidz WHERE tanggal = date('now','localtime')")
      .get().c,
  };

  const jurnalTerbaru = db
    .prepare(
      `SELECT j.tanggal, j.materi, g.nama guru, k.nama kelas, m.nama mapel
       FROM jurnal j
       JOIN guru g ON g.id=j.guru_id
       JOIN kelas k ON k.id=j.kelas_id
       JOIN mapel m ON m.id=j.mapel_id
       ORDER BY j.tanggal DESC, j.id DESC LIMIT 6`
    )
    .all();

  const tahfidzTerbaru = db
    .prepare(
      `SELECT t.tanggal, t.jenis, t.surah, t.ayat_dari, t.ayat_sampai, t.nilai, s.nama siswa
       FROM tahfidz t JOIN siswa s ON s.id=t.siswa_id
       ORDER BY t.tanggal DESC, t.id DESC LIMIT 6`
    )
    .all();

  // Ringkasan hunian asrama
  const hunian = db
    .prepare(
      `SELECT a.nama asrama, a.gender,
              (SELECT COALESCE(SUM(kapasitas),0) FROM kamar WHERE asrama_id=a.id) kapasitas,
              (SELECT COUNT(*) FROM siswa s JOIN kamar km ON km.id=s.kamar_id WHERE km.asrama_id=a.id AND s.status='Aktif') terisi
       FROM asrama a ORDER BY a.gender, a.nama`
    )
    .all();

  // Top penghafal (jumlah ziyadah tercatat)
  const topTahfidz = db
    .prepare(
      `SELECT s.nama, COUNT(*) sesi,
              MAX(t.juz) juz_tertinggi
       FROM tahfidz t JOIN siswa s ON s.id=t.siswa_id
       WHERE t.jenis='Ziyadah'
       GROUP BY t.siswa_id ORDER BY sesi DESC LIMIT 5`
    )
    .all();

  res.render('dashboard', {
    title: 'Dashboard',
    stats,
    jurnalTerbaru,
    tahfidzTerbaru,
    hunian,
    topTahfidz,
    today: new Date().toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }),
  });
});

module.exports = router;
