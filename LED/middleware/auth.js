// Session-gate + role-gate middleware shared by every route module.
const auditLog = require('../lib/auditLog');

const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/');
};

const requireAdmin = (req, res, next) => {
    if (req.session.role === 'Admin') {
        return next();
    }
    auditLog.record('ACCESS_DENIED', `${req.session.adminName || 'Unknown'} (badge #${req.session.userId}) attempted ${req.method} ${req.originalUrl} without Admin clearance.`);
    res.status(403).render('403', { adminName: req.session.adminName || null });
};

module.exports = { isAuthenticated, requireAdmin };
