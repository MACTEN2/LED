const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { isAuthenticated, requireAdmin } = require('../middleware/auth');
const { setFlash } = require('../middleware/flash');
const auditLog = require('../lib/auditLog');

const router = express.Router();

const SORTABLE_COLUMNS = new Set([
    'last_name', 'first_name', 'badge_number', 'officer_rank', 'unit_division', 'duty_status', 'hire_date',
]);

router.get('/officers', isAuthenticated, async (req, res) => {
    const search = (req.query.q || '').trim();
    const dutyStatus = (req.query.duty_status || '').trim();
    const sort = SORTABLE_COLUMNS.has(req.query.sort) ? req.query.sort : 'last_name';
    const dir = req.query.dir === 'desc' ? 'DESC' : 'ASC';

    const where = [];
    const params = [];

    if (search) {
        where.push('(first_name LIKE ? OR last_name LIKE ? OR badge_number LIKE ? OR unit_division LIKE ?)');
        const like = `%${search}%`;
        params.push(like, like, like, like);
    }
    if (dutyStatus) {
        where.push('duty_status = ?');
        params.push(dutyStatus);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    try {
        const [officers] = await db.execute(
            `SELECT badge_number, post_id, first_name, last_name, agency_name,
                    dob, work_email, officer_rank, hire_date, unit_division,
                    duty_status, created_by, created_at, role
             FROM officers
             ${whereSql}
             ORDER BY ${sort} ${dir}`,
            params
        );

        res.render('officers', {
            officers, search, dutyStatus, sort, dir,
        });
    } catch (err) {
        console.error('Officer roster error:', err);
        res.status(500).send('Database Query Error');
    }
});

router.get('/officers/:badge', isAuthenticated, async (req, res) => {
    try {
        const [[officer]] = await db.execute('SELECT * FROM officers WHERE badge_number = ?', [req.params.badge]);
        if (!officer) {
            setFlash(req, 'error', 'Officer not found.');
            return res.redirect('/officers');
        }

        const [checkouts] = await db.execute(
            `SELECT wc.*, ei.asset_tag, ei.item_name
             FROM weapon_checkouts wc
             JOIN equipment_inventory ei ON ei.id = wc.equipment_id
             WHERE wc.officer_badge = ? AND wc.checked_in_at IS NULL`,
            [req.params.badge]
        );

        const [reports] = await db.execute(
            `SELECT ir.* FROM incident_reports ir
             JOIN incident_report_officers iro ON iro.report_id = ir.id
             WHERE iro.badge_number = ?
             ORDER BY ir.occurred_at DESC`,
            [req.params.badge]
        );

        res.render('officer-detail', { officer, checkouts, reports });
    } catch (err) {
        console.error('Officer detail error:', err);
        res.status(500).send('Database Query Error');
    }
});

const officerValidation = [
    body('badge_number').isInt().withMessage('Badge number must be numeric.'),
    body('first_name').trim().notEmpty().withMessage('First name is required.'),
    body('last_name').trim().notEmpty().withMessage('Last name is required.'),
    body('work_email').isEmail().withMessage('A valid work email is required.'),
    body('agency_name').trim().notEmpty().withMessage('Agency name is required.'),
];

router.post('/officers',
    isAuthenticated, requireAdmin,
    [...officerValidation, body('password').isLength({ min: 8 }).withMessage('Access code must be at least 8 characters.')],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            setFlash(req, 'error', errors.array()[0].msg);
            return res.redirect('/officers');
        }

        const {
            badge_number, post_id, first_name, last_name,
            agency_name, dob, work_email, officer_rank,
            hire_date, unit_division, password, role,
        } = req.body;

        try {
            const hashedPassword = await bcrypt.hash(password, 10);

            await db.execute(
                `INSERT INTO officers
                    (badge_number, post_id, first_name, last_name, agency_name, dob,
                     work_email, officer_rank, hire_date, unit_division,
                     password_hash, role, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    badge_number, post_id || null, first_name, last_name,
                    agency_name, dob || null, work_email, officer_rank || null,
                    hire_date || null, unit_division || null, hashedPassword,
                    role === 'Admin' ? 'Admin' : 'User', req.session.adminName,
                ]
            );

            await auditLog.record('OFFICER_CREATED', `${req.session.adminName} recruited badge #${badge_number} (${first_name} ${last_name}).`);
            setFlash(req, 'success', `Officer ${first_name} ${last_name} added to the roster.`);
            res.redirect('/officers');
        } catch (err) {
            console.error('Add officer error:', err);
            setFlash(req, 'error', 'Could not add officer: ' + err.message);
            res.redirect('/officers');
        }
    }
);

router.get('/officers/:badge/edit', isAuthenticated, requireAdmin, async (req, res) => {
    try {
        const [[officer]] = await db.execute('SELECT * FROM officers WHERE badge_number = ?', [req.params.badge]);
        if (!officer) {
            setFlash(req, 'error', 'Officer not found.');
            return res.redirect('/officers');
        }
        res.render('officer-edit', { officer });
    } catch (err) {
        console.error('Officer edit load error:', err);
        res.status(500).send('Database Query Error');
    }
});

router.post('/officers/:badge/edit',
    isAuthenticated, requireAdmin,
    [
        body('first_name').trim().notEmpty().withMessage('First name is required.'),
        body('last_name').trim().notEmpty().withMessage('Last name is required.'),
        body('work_email').isEmail().withMessage('A valid work email is required.'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            setFlash(req, 'error', errors.array()[0].msg);
            return res.redirect(`/officers/${req.params.badge}/edit`);
        }

        const {
            first_name, last_name, agency_name, work_email, officer_rank,
            unit_division, duty_status, role,
        } = req.body;

        try {
            await db.execute(
                `UPDATE officers SET first_name = ?, last_name = ?, agency_name = ?,
                    work_email = ?, officer_rank = ?, unit_division = ?,
                    duty_status = ?, role = ?
                 WHERE badge_number = ?`,
                [
                    first_name, last_name, agency_name, work_email, officer_rank || null,
                    unit_division || null, duty_status || 'Active',
                    role === 'Admin' ? 'Admin' : 'User', req.params.badge,
                ]
            );

            await auditLog.record('OFFICER_UPDATED', `${req.session.adminName} updated badge #${req.params.badge}.`);
            setFlash(req, 'success', 'Officer record updated.');
            res.redirect(`/officers/${req.params.badge}`);
        } catch (err) {
            console.error('Officer update error:', err);
            setFlash(req, 'error', 'Could not update officer: ' + err.message);
            res.redirect(`/officers/${req.params.badge}/edit`);
        }
    }
);

router.post('/officers/:badge/status', isAuthenticated, requireAdmin, async (req, res) => {
    const { duty_status } = req.body;
    const allowed = new Set(['Active', 'Inactive', 'Terminated']);
    if (!allowed.has(duty_status)) {
        setFlash(req, 'error', 'Invalid duty status.');
        return res.redirect(`/officers/${req.params.badge}`);
    }

    try {
        await db.execute('UPDATE officers SET duty_status = ? WHERE badge_number = ?', [duty_status, req.params.badge]);
        await auditLog.record('OFFICER_STATUS_CHANGED', `${req.session.adminName} set badge #${req.params.badge} to ${duty_status}.`);
        setFlash(req, 'success', `Officer status set to ${duty_status}.`);
        res.redirect(`/officers/${req.params.badge}`);
    } catch (err) {
        console.error('Officer status error:', err);
        setFlash(req, 'error', 'Could not update status: ' + err.message);
        res.redirect(`/officers/${req.params.badge}`);
    }
});

module.exports = router;
