const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'siakad.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nama          TEXT NOT NULL,
      role          TEXT NOT NULL CHECK(role IN ('admin','guru','musyrif','siswa')),
      ref_id        INTEGER,
      aktif         INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS tahun_ajaran (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nama      TEXT NOT NULL,
      semester  TEXT NOT NULL CHECK(semester IN ('Ganjil','Genap')),
      aktif     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS guru (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      nip      TEXT,
      nama     TEXT NOT NULL,
      jk       TEXT CHECK(jk IN ('L','P')),
      no_hp    TEXT,
      jabatan  TEXT,
      aktif    INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS kelas (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nama        TEXT NOT NULL,
      jenjang     TEXT NOT NULL CHECK(jenjang IN ('SMP','SMA')),
      tingkat     INTEGER NOT NULL,
      wali_id     INTEGER REFERENCES guru(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS asrama (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      nama     TEXT NOT NULL,
      gender   TEXT NOT NULL CHECK(gender IN ('Putra','Putri')),
      pembina_id INTEGER REFERENCES guru(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS kamar (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      asrama_id  INTEGER NOT NULL REFERENCES asrama(id) ON DELETE CASCADE,
      nama       TEXT NOT NULL,
      kapasitas  INTEGER NOT NULL DEFAULT 4
    );

    CREATE TABLE IF NOT EXISTS siswa (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nis        TEXT,
      nama       TEXT NOT NULL,
      jk         TEXT NOT NULL CHECK(jk IN ('L','P')),
      tempat_lahir TEXT,
      tgl_lahir  TEXT,
      alamat     TEXT,
      wali_ortu  TEXT,
      no_hp      TEXT,
      kelas_id   INTEGER REFERENCES kelas(id) ON DELETE SET NULL,
      kamar_id   INTEGER REFERENCES kamar(id) ON DELETE SET NULL,
      status     TEXT NOT NULL DEFAULT 'Aktif' CHECK(status IN ('Aktif','Alumni','Keluar')),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS mapel (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      kode     TEXT,
      nama     TEXT NOT NULL,
      kelompok TEXT
    );

    CREATE TABLE IF NOT EXISTS jurnal (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal     TEXT NOT NULL,
      jam_ke      TEXT,
      guru_id     INTEGER NOT NULL REFERENCES guru(id) ON DELETE CASCADE,
      kelas_id    INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
      mapel_id    INTEGER NOT NULL REFERENCES mapel(id) ON DELETE CASCADE,
      materi      TEXT NOT NULL,
      metode      TEXT,
      kehadiran   INTEGER DEFAULT 0,
      total_siswa INTEGER DEFAULT 0,
      catatan     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS tahfidz (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal     TEXT NOT NULL,
      siswa_id    INTEGER NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      musyrif_id  INTEGER REFERENCES guru(id) ON DELETE SET NULL,
      jenis       TEXT NOT NULL CHECK(jenis IN ('Ziyadah','Murojaah')),
      juz         INTEGER,
      surah       TEXT NOT NULL,
      ayat_dari   INTEGER,
      ayat_sampai INTEGER,
      nilai       TEXT CHECK(nilai IN ('Mumtaz','Jayyid Jiddan','Jayyid','Maqbul','Mengulang')),
      catatan     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
}

migrate();

module.exports = db;
