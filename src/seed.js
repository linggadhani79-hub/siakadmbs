const bcrypt = require('bcryptjs');
const db = require('./db');

function hash(pw) {
  return bcrypt.hashSync(pw, 10);
}

const count = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;

function seed() {
  if (count('users') > 0) {
    console.log('Data seed sudah ada. Lewati seeding.');
    return;
  }
  console.log('Menyiapkan data awal SIAKAD MBS Poncowati...');

  const tx = db.transaction(() => {
    // Tahun ajaran
    db.prepare(`INSERT INTO tahun_ajaran (nama, semester, aktif) VALUES (?,?,1)`)
      .run('2025/2026', 'Ganjil');

    // Guru & musyrif
    const insGuru = db.prepare(
      `INSERT INTO guru (nip, nama, jk, no_hp, jabatan) VALUES (?,?,?,?,?)`
    );
    const guruList = [
      ['198501012010011001', 'Ust. Ahmad Fauzi, S.Pd.I', 'L', '081234567001', 'Kepala Sekolah'],
      ['198703152011012002', 'Ustadzah Siti Aminah, S.Pd', 'P', '081234567002', 'Guru Matematika'],
      ['199002102012011003', 'Ust. Muhammad Ridwan, Lc', 'L', '081234567003', 'Guru Bahasa Arab / Musyrif'],
      ['199105202013012004', 'Ustadzah Fatimah Zahra, S.Pd', 'P', '081234567004', 'Guru IPA / Musyrifah'],
      ['199304012014011005', 'Ust. Abdullah Hakim, S.Pd', 'L', '081234567005', 'Guru Bahasa Inggris'],
      ['199506152015012006', 'Ustadzah Khadijah, S.Ag', 'P', '081234567006', 'Musyrifah Tahfidz'],
      ['199208082016011007', 'Ust. Yusuf Mansur, S.Pd.I', 'L', '081234567007', 'Musyrif Tahfidz'],
    ];
    const guruIds = guruList.map((g) => insGuru.run(...g).lastInsertRowid);

    // Kelas
    const insKelas = db.prepare(
      `INSERT INTO kelas (nama, jenjang, tingkat, wali_id) VALUES (?,?,?,?)`
    );
    const kelasIds = {
      s7a: insKelas.run('7A', 'SMP', 7, guruIds[1]).lastInsertRowid,
      s7b: insKelas.run('7B', 'SMP', 7, guruIds[3]).lastInsertRowid,
      s8a: insKelas.run('8A', 'SMP', 8, guruIds[2]).lastInsertRowid,
      s10ipa: insKelas.run('10 IPA', 'SMA', 10, guruIds[4]).lastInsertRowid,
      s11ips: insKelas.run('11 IPS', 'SMA', 11, guruIds[5]).lastInsertRowid,
    };

    // Mapel
    const insMapel = db.prepare(`INSERT INTO mapel (kode, nama, kelompok) VALUES (?,?,?)`);
    const mapelList = [
      ['MTK', 'Matematika', 'Umum'],
      ['BIND', 'Bahasa Indonesia', 'Umum'],
      ['BING', 'Bahasa Inggris', 'Umum'],
      ['IPA', 'Ilmu Pengetahuan Alam', 'Umum'],
      ['IPS', 'Ilmu Pengetahuan Sosial', 'Umum'],
      ['BARAB', 'Bahasa Arab', 'Kepesantrenan'],
      ['TAHFIDZ', 'Tahfidz Al-Quran', 'Kepesantrenan'],
      ['FIQIH', 'Fiqih', 'Kepesantrenan'],
      ['AKIDAH', 'Akidah Akhlak', 'Kepesantrenan'],
    ];
    const mapelIds = mapelList.map((m) => insMapel.run(...m).lastInsertRowid);

    // Asrama & kamar
    const insAsrama = db.prepare(
      `INSERT INTO asrama (nama, gender, pembina_id) VALUES (?,?,?)`
    );
    const asramaPutra = insAsrama.run('Asrama Umar bin Khattab', 'Putra', guruIds[6]).lastInsertRowid;
    const asramaPutri = insAsrama.run('Asrama Aisyah', 'Putri', guruIds[5]).lastInsertRowid;

    const insKamar = db.prepare(
      `INSERT INTO kamar (asrama_id, nama, kapasitas) VALUES (?,?,?)`
    );
    const kamarIds = {
      pa1: insKamar.run(asramaPutra, 'Kamar A1', 6).lastInsertRowid,
      pa2: insKamar.run(asramaPutra, 'Kamar A2', 6).lastInsertRowid,
      pi1: insKamar.run(asramaPutri, 'Kamar B1', 6).lastInsertRowid,
      pi2: insKamar.run(asramaPutri, 'Kamar B2', 6).lastInsertRowid,
    };

    // Siswa
    const insSiswa = db.prepare(
      `INSERT INTO siswa (nis, nama, jk, tempat_lahir, tgl_lahir, alamat, wali_ortu, no_hp, kelas_id, kamar_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    const siswaData = [
      ['2025001', 'Abdurrahman Faiz', 'L', 'Lampung Tengah', '2012-03-11', 'Poncowati, Terbanggi Besar', 'Bpk. Sulaiman', '082100000001', kelasIds.s7a, kamarIds.pa1],
      ['2025002', 'Bilal Ramadhan', 'L', 'Metro', '2012-07-22', 'Bandar Jaya', 'Bpk. Ismail', '082100000002', kelasIds.s7a, kamarIds.pa1],
      ['2025003', 'Hamzah Abdullah', 'L', 'Lampung Tengah', '2012-01-05', 'Seputih Raman', 'Bpk. Hasan', '082100000003', kelasIds.s7b, kamarIds.pa2],
      ['2025004', 'Zaid Hafizh', 'L', 'Lampung Timur', '2011-11-30', 'Punggur', 'Bpk. Malik', '082100000004', kelasIds.s8a, kamarIds.pa2],
      ['2025005', 'Aisyah Nur Fadhilah', 'P', 'Lampung Tengah', '2012-04-18', 'Poncowati', 'Bpk. Zubair', '082100000005', kelasIds.s7a, kamarIds.pi1],
      ['2025006', 'Fatimah Azzahra', 'P', 'Metro', '2012-09-02', 'Kota Gajah', 'Bpk. Anas', '082100000006', kelasIds.s7b, kamarIds.pi1],
      ['2025007', 'Khadijah Salsabila', 'P', 'Lampung Tengah', '2011-12-14', 'Gunung Sugih', 'Bpk. Umar', '082100000007', kelasIds.s8a, kamarIds.pi2],
      ['2025008', 'Umar Faruq', 'L', 'Lampung Tengah', '2009-05-19', 'Terbanggi Besar', 'Bpk. Ali', '082100000008', kelasIds.s10ipa, kamarIds.pa1],
      ['2025009', 'Maryam Qonita', 'P', 'Metro', '2008-08-27', 'Bandar Jaya', 'Bpk. Yasin', '082100000009', kelasIds.s11ips, kamarIds.pi2],
      ['2025010', 'Ibrahim Khalil', 'L', 'Lampung Timur', '2009-02-08', 'Sekampung', 'Bpk. Idris', '082100000010', kelasIds.s10ipa, kamarIds.pa2],
    ];
    const siswaIds = siswaData.map((s) => insSiswa.run(...s).lastInsertRowid);

    // Users
    const insUser = db.prepare(
      `INSERT INTO users (username, password_hash, nama, role, ref_id) VALUES (?,?,?,?,?)`
    );
    insUser.run('admin', hash('admin123'), 'Administrator', 'admin', null);
    insUser.run('guru', hash('guru123'), guruList[1][1], 'guru', guruIds[1]);
    insUser.run('musyrif', hash('musyrif123'), guruList[5][1], 'musyrif', guruIds[5]);
    insUser.run('siswa', hash('siswa123'), siswaData[0][1], 'siswa', siswaIds[0]);

    // Jurnal contoh
    const insJurnal = db.prepare(
      `INSERT INTO jurnal (tanggal, jam_ke, guru_id, kelas_id, mapel_id, materi, metode, kehadiran, total_siswa, catatan)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    insJurnal.run('2026-07-14', '1-2', guruIds[1], kelasIds.s7a, mapelIds[0], 'Bilangan bulat dan operasinya', 'Ceramah & latihan', 3, 3, 'Siswa antusias');
    insJurnal.run('2026-07-14', '3-4', guruIds[2], kelasIds.s8a, mapelIds[5], 'Muhadatsah: Ta\'aruf', 'Praktik percakapan', 1, 1, '-');
    insJurnal.run('2026-07-15', '1-2', guruIds[4], kelasIds.s10ipa, mapelIds[2], 'Descriptive text', 'Diskusi kelompok', 2, 2, '-');

    // Tahfidz contoh
    const insTahfidz = db.prepare(
      `INSERT INTO tahfidz (tanggal, siswa_id, musyrif_id, jenis, juz, surah, ayat_dari, ayat_sampai, nilai, catatan)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    insTahfidz.run('2026-07-14', siswaIds[0], guruIds[6], 'Ziyadah', 30, 'An-Naba', 1, 20, 'Jayyid Jiddan', 'Lanjut ayat 21');
    insTahfidz.run('2026-07-14', siswaIds[4], guruIds[5], 'Ziyadah', 30, 'An-Nazi\'at', 1, 15, 'Mumtaz', 'Sangat lancar');
    insTahfidz.run('2026-07-15', siswaIds[0], guruIds[6], 'Murojaah', 30, 'An-Naba', 1, 40, 'Jayyid', 'Perbaiki tajwid');
    insTahfidz.run('2026-07-15', siswaIds[7], guruIds[6], 'Ziyadah', 29, 'Al-Mulk', 1, 10, 'Maqbul', 'Perlu diulang');
  });

  tx();
  console.log('Seeding selesai.');
  console.log('Akun default:');
  console.log('  admin   / admin123   (Administrator)');
  console.log('  guru    / guru123    (Guru)');
  console.log('  musyrif / musyrif123 (Musyrif Tahfidz)');
  console.log('  siswa   / siswa123   (Siswa)');
}

seed();
