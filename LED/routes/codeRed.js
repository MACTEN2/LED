const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const { setFlash } = require('../middleware/flash');
const auditLog = require('../lib/auditLog');
const codeRedState = require('../lib/codeRedState');

const router = express.Router();

// No requireAdmin here on purpose: in an emergency any officer needs to be
// able to trigger this in one click, not wait on an admin.
router.post('/code-red/activate', isAuthenticated, async (req, res) => {
    codeRedState.activate(req.session.adminName);
    await auditLog.record('CODE_RED_ACTIVATED', `${req.session.adminName} activated Code Red.`);
    setFlash(req, 'success', 'Code Red activated.');
    res.redirect(req.get('Referer') || '/dashboard');
});

router.post('/code-red/resolve', isAuthenticated, async (req, res) => {
    codeRedState.resolve();
    await auditLog.record('CODE_RED_RESOLVED', `${req.session.adminName} resolved Code Red.`);
    setFlash(req, 'success', 'Code Red resolved.');
    res.redirect(req.get('Referer') || '/dashboard');
});

module.exports = router;
