function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('error', {
        title: 'Akses Ditolak',
        message: 'Anda tidak memiliki hak akses untuk halaman ini.',
      });
    }
    next();
  };
}

// Guru & musyrif keduanya boleh input jurnal/tahfidz sesuai konteks
const staff = ['admin', 'guru', 'musyrif'];

module.exports = { requireLogin, requireRole, staff };
