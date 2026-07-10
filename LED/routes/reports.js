const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');
const { setFlash } = require('../middleware/flash');
const auditLog = require('../lib/auditLog');

const router = express.Router();

const STATUSES = ['Open', 'Pending Review', 'Closed'];

router.get('/reports', isAuthenticated, async (req, res) => {
    const status = (req.query.status || '').trim();
    const search = (req.query.q || '').trim();

    const where = [];
    const params = [];
    if (status) {
        where.push('ir.status = ?');
        params.push(status);
    }
    if (search) {
        where.push('(ir.title LIKE ? OR ir.report_number LIKE ? OR ir.location LIKE ?)');
        const like = `%${search}%`;
        params.push(like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    try {
        const [reports] = await db.execute(
            `SELECT ir.* FROM incident_reports ir ${whereSql} ORDER BY ir.occurred_at DESC`,
            params
        );
        res.render('reports', { reports, status, search, statuses: STATUSES });
    } catch (err) {
        console.error('Reports list error:', err);
        res.status(500).send('Database Query Error');
    }
});

router.get('/reports/new', isAuthenticated, async (req, res) => {
    try {
        const [officers] = await db.execute(
            'SELECT badge_number, first_name, last_name FROM officers ORDER BY last_name'
        );
        res.render('report-form', { officers, report: null });
    } catch (err) {
        console.error('Report form load error:', err);
        res.status(500).send('Database Query Error');
    }
});

router.post('/reports',
    isAuthenticated,
    [
        body('title').trim().notEmpty().withMessage('Title is required.'),
        body('report_type').trim().notEmpty().withMessage('Report type is required.'),
        body('occurred_at').notEmpty().withMessage('Date/time of occurrence is required.'),
        body('narrative').trim().isLength({ min: 10 }).withMessage('Narrative must be at least 10 characters.'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            setFlash(req, 'error', errors.array()[0].msg);
            return res.redirect('/reports/new');
        }

        const { title, report_type, occurred_at, location, narrative } = req.body;
        const involvedBadges = [].concat(req.body.involved_officers || []).filter(Boolean);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const [result] = await conn.execute(
                `INSERT INTO incident_reports (report_number, report_type, title, narrative, location, occurred_at, filed_by, status)
                 VALUES (CONCAT('TMP-', UUID()), ?, ?, ?, ?, ?, ?, 'Open')`,
                [report_type, title, narrative, location || null, occurred_at, req.session.adminName]
            );

            const reportId = result.insertId;
            const reportNumber = `INC-${new Date().getFullYear()}-${String(reportId).padStart(6, '0')}`;
            await conn.execute('UPDATE incident_reports SET report_number = ? WHERE id = ?', [reportNumber, reportId]);

            for (const badge of involvedBadges) {
                await conn.execute(
                    'INSERT INTO incident_report_officers (report_id, badge_number) VALUES (?, ?)',
                    [reportId, badge]
                );
            }

            await conn.commit();
            await auditLog.record('REPORT_FILED', `${req.session.adminName} filed report ${reportNumber}: ${title}.`);
            setFlash(req, 'success', `Report ${reportNumber} filed.`);
            res.redirect(`/reports/${reportId}`);
        } catch (err) {
            await conn.rollback();
            console.error('File report error:', err);
            setFlash(req, 'error', 'Could not file report: ' + err.message);
            res.redirect('/reports/new');
        } finally {
            conn.release();
        }
    }
);

router.get('/reports/:id', isAuthenticated, async (req, res) => {
    try {
        const [[report]] = await db.execute('SELECT * FROM incident_reports WHERE id = ?', [req.params.id]);
        if (!report) {
            setFlash(req, 'error', 'Report not found.');
            return res.redirect('/reports');
        }

        const [involved] = await db.execute(
            `SELECT o.badge_number, o.first_name, o.last_name
             FROM incident_report_officers iro
             JOIN officers o ON o.badge_number = iro.badge_number
             WHERE iro.report_id = ?`,
            [req.params.id]
        );

        const canManage = req.session.role === 'Admin' || report.filed_by === req.session.adminName;
        res.render('report-view', { report, involved, canManage, statuses: STATUSES });
    } catch (err) {
        console.error('Report view error:', err);
        res.status(500).send('Database Query Error');
    }
});

router.post('/reports/:id/status', isAuthenticated, async (req, res) => {
    const { status } = req.body;
    if (!STATUSES.includes(status)) {
        setFlash(req, 'error', 'Invalid status.');
        return res.redirect(`/reports/${req.params.id}`);
    }

    try {
        const [[report]] = await db.execute('SELECT filed_by FROM incident_reports WHERE id = ?', [req.params.id]);
        if (!report) {
            setFlash(req, 'error', 'Report not found.');
            return res.redirect('/reports');
        }
        if (req.session.role !== 'Admin' && report.filed_by !== req.session.adminName) {
            return res.status(403).render('403', { adminName: req.session.adminName });
        }

        await db.execute('UPDATE incident_reports SET status = ? WHERE id = ?', [status, req.params.id]);
        await auditLog.record('REPORT_STATUS_CHANGED', `${req.session.adminName} set report #${req.params.id} to ${status}.`);
        setFlash(req, 'success', `Report marked ${status}.`);
        res.redirect(`/reports/${req.params.id}`);
    } catch (err) {
        console.error('Report status error:', err);
        setFlash(req, 'error', 'Could not update status: ' + err.message);
        res.redirect(`/reports/${req.params.id}`);
    }
});

module.exports = router;
