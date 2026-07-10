const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { setFlash } = require('../middleware/flash');
const lockout = require('../lib/loginLockout');

const router = express.Router();

router.get('/', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('login');
});

router.post('/login', async (req, res) => {
    const { badge_number, password } = req.body;

    if (!badge_number || !password) {
        setFlash(req, 'error', 'Badge number and access code are required.');
        return res.redirect('/');
    }

    if (lockout.isLocked(badge_number)) {
        setFlash(req, 'error', `Account locked. Try again in ${lockout.remainingLockSeconds(badge_number)}s.`);
        return res.redirect('/');
    }

    try {
        const [rows] = await db.execute('SELECT * FROM officers WHERE badge_number = ?', [badge_number]);

        if (rows.length > 0) {
            const officer = rows[0];
            const match = await bcrypt.compare(password, officer.password_hash);

            if (match) {
                lockout.recordSuccess(badge_number);

                req.session.regenerate((err) => {
                    if (err) {
                        console.error('[SESSION] Regenerate failed:', err);
                        setFlash(req, 'error', 'Security System Failure');
                        return res.redirect('/');
                    }

                    req.session.userId = officer.badge_number;
                    req.session.adminName = `${officer.first_name} ${officer.last_name}`;
                    req.session.role = officer.role;

                    console.log(`[SESSION] Started for: ${req.session.adminName}`);
                    res.redirect('/dashboard');
                });
                return;
            }
        }

        lockout.recordFailure(badge_number);
        setFlash(req, 'error', 'Invalid credentials.');
        res.redirect('/');
    } catch (err) {
        console.error(err);
        setFlash(req, 'error', 'Security System Failure');
        res.redirect('/');
    }
});

router.get('/logout', (req, res) => {
    const adminName = req.session.adminName;
    req.session.destroy((err) => {
        if (err) console.error('[SESSION] Destroy failed:', err);
        res.clearCookie('connect.sid');
        console.log(`[SESSION] Ended for: ${adminName || 'unknown'}`);
        res.redirect('/');
    });
});

module.exports = router;
