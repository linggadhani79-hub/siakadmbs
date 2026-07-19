const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const flash = (req, type, msg) => { req.session.flash = { type, msg }; };

router.use(requireRole('admin'));

// Parser CSV sederhana (mendukung tanda kutip)
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',' || c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((x) => x.trim() !== '')) rows.push(row); }
  return rows;
}

const CONTOH = {
  siswa: 'nis,nama,jk,tempat_lahir,tgl_lahir,alamat,wali_ortu,no_hp,kelas\n2026001,Ahmad Fulan,L,Metro,2012-01-15,Poncowati,Bpk. Fulan,08123456789,7A',
  guru: 'nip,nama,jk,jabatan,no_hp\n19900101,Ust. Fulan S.Pd,L,Guru Matematika,08123456789',
};

router.get('/:jenis', (req, res) => {
  const jenis = req.params.jenis;
  if (!CONTOH[jenis]) return res.redirect('/dashboard');
  res.render('ekspor/impor', { title: `Impor ${jenis === 'siswa' ? 'Siswa' : 'Guru'}`, jenis, contoh: CONTOH[jenis] });
});

router.post('/:jenis', (req, res) => {
  const jenis = req.params.jenis;
  if (!CONTOH[jenis]) return res.redirect('/dashboard');
  const rows = parseCSV(req.body.csv || '');
  if (rows.length < 2) {
    flash(req, 'error', 'CSV kosong atau hanya berisi header.');
    return res.redirect('/impor/' + jenis);
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  let masuk = 0, gagal = 0;

  const tx = db.transaction(() => {
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const val = (name) => { const j = idx(name); return j >= 0 ? (r[j] || '').trim() || null : null; };
      try {
        if (jenis === 'siswa') {
          const nama = val('nama');
          if (!nama) { gagal++; continue; }
          let kelasId = null;
          const kelasNama = val('kelas');
          if (kelasNama) {
            const k = db.prepare('SELECT id FROM kelas WHERE lower(nama)=lower(?)').get(kelasNama);
            kelasId = k ? k.id : null;
          }
          db.prepare(
            `INSERT INTO siswa (nis,nama,jk,tempat_lahir,tgl_lahir,alamat,wali_ortu,no_hp,kelas_id)
             VALUES (?,?,?,?,?,?,?,?,?)`
          ).run(val('nis'), nama, (val('jk') || 'L').toUpperCase() === 'P' ? 'P' : 'L',
                val('tempat_lahir'), val('tgl_lahir'), val('alamat'), val('wali_ortu'), val('no_hp'), kelasId);
          masuk++;
        } else {
          const nama = val('nama');
          if (!nama) { gagal++; continue; }
          db.prepare('INSERT INTO guru (nip,nama,jk,jabatan,no_hp) VALUES (?,?,?,?,?)')
            .run(val('nip'), nama, (val('jk') || 'L').toUpperCase() === 'P' ? 'P' : 'L', val('jabatan'), val('no_hp'));
          masuk++;
        }
      } catch (e) { gagal++; }
    }
  });
  tx();

  flash(req, gagal ? 'error' : 'success', `Impor selesai: ${masuk} baris masuk${gagal ? `, ${gagal} gagal` : ''}.`);
  res.redirect(jenis === 'siswa' ? '/siswa' : '/guru');
});

module.exports = router;
