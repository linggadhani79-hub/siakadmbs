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
    pendaftarBaru: db
      .prepare("SELECT COUNT(*) c FROM pendaftar WHERE status='Baru'")
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

  // Kehadiran 7 hari terakhir (untuk mini bar chart)
  const absensiRows = db
    .prepare(
      `SELECT tanggal,
              SUM(CASE WHEN status='Hadir' THEN 1 ELSE 0 END) hadir,
              COUNT(*) total
       FROM absensi
       WHERE tanggal >= date('now','localtime','-6 day')
       GROUP BY tanggal`
    )
    .all();
  const absensiMap = {};
  absensiRows.forEach((r) => { absensiMap[r.tanggal] = r; });
  const HARI_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const kehadiran7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const row = absensiMap[key];
    kehadiran7.push({
      label: HARI_ID[d.getDay()],
      hadir: row ? row.hadir : 0,
      total: row ? row.total : 0,
    });
  }
  const maxHadir = Math.max(1, ...kehadiran7.map((k) => k.hadir));

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
    kehadiran7,
    maxHadir,
    today: new Date().toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }),
  });
});

module.exports = router;
