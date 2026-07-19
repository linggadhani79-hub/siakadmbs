const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

const today = () => new Date().toISOString().slice(0, 10);
const nowHM = () => {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};
const BATAS_TERLAMBAT = '07:30';

// Jarak haversine dalam meter
function jarakMeter(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// Cari lokasi aktif terdekat; kembalikan {lokasi, jarak} atau null
function cekLokasi(lat, lng) {
  const daftar = db.prepare('SELECT * FROM lokasi_presensi WHERE aktif=1').all();
  if (!daftar.length) return { error: 'Titik lokasi presensi belum diatur oleh admin.' };
  let best = null;
  for (const l of daftar) {
    const d = jarakMeter(lat, lng, l.lat, l.lng);
    if (!best || d < best.jarak) best = { lokasi: l, jarak: d };
  }
  if (best.jarak > best.lokasi.radius_m) {
    return {
      error: `Anda berada ${best.jarak} m dari ${best.lokasi.nama} (maks. ${best.lokasi.radius_m} m). Presensi ditolak.`,
    };
  }
  return best;
}

// Semua rute presensi untuk staff (admin, guru/kepala sekolah, musyrif)
router.use(requireRole('admin', 'guru', 'musyrif'));

// ===== Halaman absen =====
router.get('/', (req, res) => {
  const hariIni = db
    .prepare('SELECT * FROM presensi WHERE user_id=? AND tanggal=?')
    .get(req.session.user.id, today());
  const lokasi = db.prepare('SELECT * FROM lokasi_presensi WHERE aktif=1').all();
  res.render('presensi/index', { title: 'Presensi Staff', hariIni, lokasi, batas: BATAS_TERLAMBAT });
});

function validasi(req, res) {
  const lat = parseFloat(req.body.lat);
  const lng = parseFloat(req.body.lng);
  const foto = req.body.foto || '';
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    flash(req, 'error', 'Lokasi GPS tidak terbaca. Izinkan akses lokasi lalu coba lagi.');
    return null;
  }
  if (!foto.startsWith('data:image/')) {
    flash(req, 'error', 'Foto wajah wajib diambil sebelum presensi.');
    return null;
  }
  const cek = cekLokasi(lat, lng);
  if (cek.error) {
    flash(req, 'error', cek.error);
    return null;
  }
  return { lat, lng, foto, cek };
}

router.post('/masuk', (req, res) => {
  const v = validasi(req, res);
  if (!v) return res.redirect('/presensi');
  const uid = req.session.user.id;
  const ada = db.prepare('SELECT id FROM presensi WHERE user_id=? AND tanggal=?').get(uid, today());
  if (ada) {
    flash(req, 'error', 'Anda sudah melakukan presensi masuk hari ini.');
    return res.redirect('/presensi');
  }
  const jam = nowHM();
  db.prepare(
    `INSERT INTO presensi (user_id,tanggal,jam_masuk,lat_masuk,lng_masuk,jarak_masuk,foto_masuk,lokasi_id,status)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(uid, today(), jam, v.lat, v.lng, v.cek.jarak, v.foto, v.cek.lokasi.id,
        jam > BATAS_TERLAMBAT ? 'Terlambat' : 'Hadir');
  flash(req, 'success', `Presensi masuk ${jam} tercatat (${v.cek.jarak} m dari ${v.cek.lokasi.nama}).`);
  res.redirect('/presensi');
});

router.post('/pulang', (req, res) => {
  const v = validasi(req, res);
  if (!v) return res.redirect('/presensi');
  const uid = req.session.user.id;
  const row = db.prepare('SELECT * FROM presensi WHERE user_id=? AND tanggal=?').get(uid, today());
  if (!row || !row.jam_masuk) {
    flash(req, 'error', 'Belum ada presensi masuk hari ini.');
    return res.redirect('/presensi');
  }
  if (row.jam_pulang) {
    flash(req, 'error', 'Presensi pulang sudah tercatat.');
    return res.redirect('/presensi');
  }
  const jam = nowHM();
  db.prepare(
    `UPDATE presensi SET jam_pulang=?, lat_pulang=?, lng_pulang=?, jarak_pulang=?, foto_pulang=? WHERE id=?`
  ).run(jam, v.lat, v.lng, v.cek.jarak, v.foto, row.id);
  flash(req, 'success', `Presensi pulang ${jam} tercatat. Hati-hati di jalan!`);
  res.redirect('/presensi');
});

// ===== Riwayat pribadi =====
router.get('/riwayat', (req, res) => {
  const bulan = req.query.bulan || today().slice(0, 7);
  const riwayat = db
    .prepare(`SELECT * FROM presensi WHERE user_id=? AND substr(tanggal,1,7)=? ORDER BY tanggal DESC`)
    .all(req.session.user.id, bulan);
  res.render('presensi/riwayat', { title: 'Riwayat Presensi', riwayat, bulan });
});

// ===== Rekap semua staff (admin) =====
router.get('/rekap', requireRole('admin'), (req, res) => {
  const tanggal = req.query.tanggal || today();
  const rekap = db
    .prepare(
      `SELECT p.*, u.nama, u.role, l.nama lokasi
       FROM presensi p JOIN users u ON u.id=p.user_id
       LEFT JOIN lokasi_presensi l ON l.id=p.lokasi_id
       WHERE p.tanggal=? ORDER BY p.jam_masuk`
    )
    .all(tanggal);
  const staff = db
    .prepare(`SELECT id, nama, role FROM users WHERE role IN ('admin','guru','musyrif') AND aktif=1`)
    .all();
  const sudah = new Set(rekap.map((r) => r.user_id));
  const belum = staff.filter((s) => !sudah.has(s.id));
  res.render('presensi/rekap', { title: 'Rekap Presensi Staff', rekap, belum, tanggal });
});

// ===== Lihat foto (admin atau pemilik) =====
router.get('/foto/:id/:jenis', (req, res) => {
  const row = db.prepare('SELECT * FROM presensi WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).end();
  const user = req.session.user;
  if (user.role !== 'admin' && row.user_id !== user.id) return res.status(403).end();
  const data = req.params.jenis === 'pulang' ? row.foto_pulang : row.foto_masuk;
  if (!data) return res.status(404).end();
  const m = data.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return res.status(404).end();
  res.set('Content-Type', m[1]).send(Buffer.from(m[2], 'base64'));
});

// ===== Kelola titik lokasi (admin) =====
router.get('/lokasi', requireRole('admin'), (req, res) => {
  const lokasi = db.prepare('SELECT * FROM lokasi_presensi ORDER BY nama').all();
  res.render('presensi/lokasi', { title: 'Titik Lokasi Presensi', lokasi });
});

router.post('/lokasi', requireRole('admin'), (req, res) => {
  const b = req.body;
  db.prepare('INSERT INTO lokasi_presensi (nama,lat,lng,radius_m) VALUES (?,?,?,?)')
    .run(b.nama.trim(), parseFloat(b.lat), parseFloat(b.lng), parseInt(b.radius_m, 10) || 300);
  flash(req, 'success', 'Titik lokasi ditambahkan.');
  res.redirect('/presensi/lokasi');
});

router.post('/lokasi/:id/toggle', requireRole('admin'), (req, res) => {
  const l = db.prepare('SELECT aktif FROM lokasi_presensi WHERE id=?').get(req.params.id);
  if (l) db.prepare('UPDATE lokasi_presensi SET aktif=? WHERE id=?').run(l.aktif ? 0 : 1, req.params.id);
  res.redirect('/presensi/lokasi');
});

router.delete('/lokasi/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM lokasi_presensi WHERE id=?').run(req.params.id);
  flash(req, 'success', 'Titik lokasi dihapus.');
  res.redirect('/presensi/lokasi');
});

module.exports = router;
