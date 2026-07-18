# SIAKAD MBS Poncowati

Sistem Informasi Akademik (SIAKAD) untuk **SMP & SMA MBS Poncowati** — mengintegrasikan
tata kelola sekolah dengan pengelolaan pondok pesantren dalam satu aplikasi.

Aplikasi ini mencakup pencatatan **jurnal mengajar**, **manajemen tahfidz Al-Quran**,
serta **pembagian kamar asrama** santri, di samping data master sekolah pada umumnya.

## Fitur

### Akademik Sekolah
- **Dashboard** ringkasan: jumlah santri, guru, rombel, kamar, jurnal & setoran hari ini,
  hunian asrama, dan santri teraktif tahfidz.
- **Data Siswa/Santri** — CRUD lengkap dengan profil, kelas, kamar, dan riwayat tahfidz.
- **Guru & Musyrif** — data pegawai dan penugasan.
- **Kelas / Rombel** — jenjang SMP/SMA, tingkat, wali kelas.
- **Mata Pelajaran** — kelompok Umum & Kepesantrenan.

### Jurnal Mengajar
- Pencatatan kegiatan belajar per pertemuan: tanggal, jam, kelas, mapel, materi,
  metode, dan kehadiran.
- Guru hanya melihat jurnal miliknya; admin melihat seluruh jurnal.
- Filter berdasarkan tanggal, kelas, dan guru.

### Manajemen Tahfidz Al-Quran
- Input setoran **Ziyadah** (hafalan baru) & **Murojaah** (pengulangan).
- Detail surah, ayat, juz, musyrif penyimak, catatan, dan penilaian
  (*Mumtaz, Jayyid Jiddan, Jayyid, Maqbul, Mengulang*).
- **Rekap capaian** progres hafalan seluruh santri (juz tertinggi, sesi ziyadah/murojaah).
- Santri hanya dapat melihat riwayat setorannya sendiri.

### Pembagian Kamar Asrama
- Pengelolaan **asrama** (Putra/Putri) beserta **kamar** dan kapasitasnya.
- Penempatan santri ke kamar dengan **validasi otomatis**:
  gender santri harus sesuai asrama, dan kapasitas kamar tidak boleh terlampaui.
- Tampilan visual hunian setiap kamar dan daftar santri yang belum ditempatkan.

### Sistem
- Login berbasis peran: **admin, guru, musyrif, siswa** dengan hak akses berbeda.
- Manajemen pengguna: tambah akun, reset password, aktif/nonaktif.

## Teknologi
- **Node.js** + **Express**
- **better-sqlite3** (basis data SQLite, tanpa server terpisah)
- **EJS** untuk templating server-side
- **bcryptjs** untuk hashing password

## Menjalankan

```bash
npm install      # pasang dependensi
npm run seed     # (opsional) isi data awal & akun demo
npm start        # jalankan di http://localhost:3000
```

> Data awal juga otomatis dibuat saat pertama kali server dijalankan.
> Basis data tersimpan di `data/siakad.db`.

## Akun Demo

| Username  | Password    | Peran               |
|-----------|-------------|---------------------|
| `admin`   | `admin123`  | Administrator       |
| `guru`    | `guru123`   | Guru                |
| `musyrif` | `musyrif123`| Musyrif Tahfidz     |
| `siswa`   | `siswa123`  | Santri              |

## Struktur Proyek

```
server.js            # entry point Express
src/
  db.js              # koneksi & skema database
  seed.js            # data awal (guru, kelas, santri, dll)
  middleware/auth.js # proteksi login & role
  routes/            # route per modul
views/               # template EJS
public/css/          # gaya tampilan
```

## Catatan Keamanan
Akun demo bersifat contoh. **Ganti seluruh password default** sebelum dipakai
pada lingkungan nyata, dan atur `SESSION_SECRET` melalui environment variable.
