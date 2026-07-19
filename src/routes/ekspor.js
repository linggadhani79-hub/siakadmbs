const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

// ===== Definisi dataset =====
const DATASETS = {
  siswa: {
    judul: 'Data Siswa / Santri',
    sql: `SELECT s.nis AS NIS, s.nama AS Nama, s.jk AS JK, s.tempat_lahir AS Tempat_Lahir,
                 s.tgl_lahir AS Tgl_Lahir, s.alamat AS Alamat, s.wali_ortu AS Wali,
                 s.no_hp AS No_HP, k.nama AS Kelas, km.nama AS Kamar, s.kartu_id AS ID_Kartu, s.status AS Status
          FROM siswa s LEFT JOIN kelas k ON k.id=s.kelas_id LEFT JOIN kamar km ON km.id=s.kamar_id
          ORDER BY k.tingkat, k.nama, s.nama`,
  },
  guru: {
    judul: 'Data Guru & Musyrif',
    sql: `SELECT nip AS NIP, nama AS Nama, jk AS JK, jabatan AS Jabatan, no_hp AS No_HP FROM guru ORDER BY nama`,
  },
  kelas: {
    judul: 'Data Kelas',
    sql: `SELECT k.nama AS Kelas, k.jenjang AS Jenjang, k.tingkat AS Tingkat, g.nama AS Wali_Kelas,
                 (SELECT COUNT(*) FROM siswa s WHERE s.kelas_id=k.id AND s.status='Aktif') AS Jml_Siswa
          FROM kelas k LEFT JOIN guru g ON g.id=k.wali_id ORDER BY k.tingkat, k.nama`,
  },
  mapel: {
    judul: 'Data Mata Pelajaran',
    sql: `SELECT kode AS Kode, nama AS Nama, kelompok AS Kelompok FROM mapel ORDER BY kelompok, nama`,
  },
  jurnal: {
    judul: 'Jurnal Mengajar',
    sql: `SELECT j.tanggal AS Tanggal, j.jam_ke AS Jam, g.nama AS Guru, k.nama AS Kelas, m.nama AS Mapel,
                 j.materi AS Materi, j.metode AS Metode, j.kehadiran AS Hadir, j.total_siswa AS Total, j.catatan AS Catatan
          FROM jurnal j JOIN guru g ON g.id=j.guru_id JOIN kelas k ON k.id=j.kelas_id JOIN mapel m ON m.id=j.mapel_id
          ORDER BY j.tanggal DESC`,
  },
  tahfidz: {
    judul: 'Setoran Tahfidz Al-Quran',
    sql: `SELECT t.tanggal AS Tanggal, s.nama AS Santri, k.nama AS Kelas, t.jenis AS Jenis, t.juz AS Juz,
                 t.surah AS Surah, t.ayat_dari AS Ayat_Dari, t.ayat_sampai AS Ayat_Sampai, t.nilai AS Nilai,
                 g.nama AS Musyrif, t.catatan AS Catatan
          FROM tahfidz t JOIN siswa s ON s.id=t.siswa_id LEFT JOIN kelas k ON k.id=s.kelas_id
          LEFT JOIN guru g ON g.id=t.musyrif_id ORDER BY t.tanggal DESC`,
  },
  absensi: {
    judul: 'Absensi Harian Santri',
    sql: `SELECT a.tanggal AS Tanggal, s.nama AS Santri, k.nama AS Kelas, a.status AS Status,
                 a.jam AS Jam, a.keterangan AS Keterangan, a.dicatat_oleh AS Dicatat_Oleh
          FROM absensi a JOIN siswa s ON s.id=a.siswa_id LEFT JOIN kelas k ON k.id=a.kelas_id
          ORDER BY a.tanggal DESC, s.nama`,
  },
  pendaftar: {
    judul: 'Pendaftar PSB',
    sql: `SELECT no_reg AS No_Registrasi, nama AS Nama, jk AS JK, jenjang AS Jenjang, asal_sekolah AS Asal_Sekolah,
                 tempat_lahir AS Tempat_Lahir, tgl_lahir AS Tgl_Lahir, nama_ortu AS Orang_Tua, no_hp AS No_HP,
                 email AS Email, status AS Status, created_at AS Tgl_Daftar
          FROM pendaftar ORDER BY created_at DESC`,
  },
  presensi: {
    judul: 'Presensi Staff',
    adminOnly: true,
    sql: `SELECT p.tanggal AS Tanggal, u.nama AS Nama, u.role AS Role, p.jam_masuk AS Masuk,
                 p.jam_pulang AS Pulang, p.status AS Status, p.jarak_masuk AS Jarak_m, l.nama AS Lokasi
          FROM presensi p JOIN users u ON u.id=p.user_id LEFT JOIN lokasi_presensi l ON l.id=p.lokasi_id
          ORDER BY p.tanggal DESC, p.jam_masuk`,
  },
};

router.use(requireRole('admin', 'guru', 'musyrif'));

function ambil(req, res) {
  const ds = DATASETS[req.params.jenis];
  if (!ds) { res.status(404).send('Dataset tidak dikenal'); return null; }
  if (ds.adminOnly && req.session.user.role !== 'admin') { res.status(403).send('Khusus admin'); return null; }
  const rows = db.prepare(ds.sql).all();
  return { ds, rows };
}

// ===== Ekspor CSV =====
router.get('/:jenis.csv', (req, res) => {
  const d = ambil(req, res);
  if (!d) return;
  const cols = d.rows.length ? Object.keys(d.rows[0]) : ['(kosong)'];
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = '﻿' + [cols.join(','), ...d.rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${req.params.jenis}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// ===== Ekspor PDF (tampilan cetak) =====
router.get('/:jenis/cetak', (req, res) => {
  const d = ambil(req, res);
  if (!d) return;
  const cols = d.rows.length ? Object.keys(d.rows[0]) : [];
  res.render('ekspor/cetak', { judul: d.ds.judul, cols, rows: d.rows });
});

module.exports = router;
