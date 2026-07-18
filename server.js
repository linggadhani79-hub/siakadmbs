const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');

const db = require('./src/db');
require('./src/seed');

const { requireLogin } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'mbs-poncowati-siakad-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);

// Locals untuk semua view
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.path = req.path;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Routes
app.use('/', require('./src/routes/public'));
app.use('/', require('./src/routes/auth'));
app.use('/dashboard', requireLogin, require('./src/routes/dashboard'));
app.use('/pendaftar', requireLogin, require('./src/routes/pendaftar'));
app.use('/siswa', requireLogin, require('./src/routes/siswa'));
app.use('/guru', requireLogin, require('./src/routes/guru'));
app.use('/kelas', requireLogin, require('./src/routes/kelas'));
app.use('/mapel', requireLogin, require('./src/routes/mapel'));
app.use('/asrama', requireLogin, require('./src/routes/asrama'));
app.use('/kamar', requireLogin, require('./src/routes/kamar'));
app.use('/jurnal', requireLogin, require('./src/routes/jurnal'));
app.use('/tahfidz', requireLogin, require('./src/routes/tahfidz'));
app.use('/users', requireLogin, require('./src/routes/users'));

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Halaman Tidak Ditemukan',
    message: 'Halaman yang Anda cari tidak tersedia.',
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Terjadi Kesalahan',
    message: process.env.NODE_ENV === 'production' ? 'Terjadi kesalahan pada server.' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`SIAKAD MBS Poncowati berjalan di http://localhost:${PORT}`);
});
