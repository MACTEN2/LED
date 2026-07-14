const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { isAuthenticated, requireAdmin } = require('../middleware/auth');
const { setFlash } = require('../middleware/flash');
const auditLog = require('../lib/auditLog');

const router = express.Router();

router.get('/equipment', isAuthenticated, async (req, res) => {
    const search = (req.query.q || '').trim();
    const status = (req.query.status || '').trim();

    const where = [];
    const params = [];

    if (search) {
        where.push('(asset_tag LIKE ? OR item_name LIKE ? OR serial_number LIKE ? OR category LIKE ?)');
        const like = `%${search}%`;
        params.push(like, like, like, like);
    }
    if (status) {
        where.push('status = ?');
        params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    try {
        const [inventory] = await db.execute(
            `SELECT ei.*, o.first_name AS assigned_first_name, o.last_name AS assigned_last_name
             FROM equipment_inventory ei
             LEFT JOIN officers o ON o.badge_number = ei.assigned_to
             ${whereSql}
             ORDER BY ei.item_name ASC`,
            params
        );
        res.render('equipment', { inventory, search, status });
    } catch (err) {
        console.error('Equipment list error:', err);
        res.status(500).send('Database Query Error');
    }
});

router.post('/equipment',
    isAuthenticated, requireAdmin,
    [
        body('asset_tag').trim().notEmpty().withMessage('Asset tag is required.'),
        body('item_name').trim().notEmpty().withMessage('Item name is required.'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            setFlash(req, 'error', errors.array()[0].msg);
            return res.redirect('/equipment');
        }

        const { asset_tag, item_name, category, serial_number, caliber, status } = req.body;

        try {
            await db.execute(
                `INSERT INTO equipment_inventory (asset_tag, item_name, category, serial_number, caliber, status)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [asset_tag, item_name, category || null, serial_number || null, caliber || null, status || 'Available']
            );

            await auditLog.record('EQUIPMENT_ADDED', `${req.session.adminName} added ${item_name} (${asset_tag}) to the armory.`);
            setFlash(req, 'success', `${item_name} added to the armory.`);
            res.redirect('/equipment');
        } catch (err) {
            console.error('Add equipment error:', err);
            setFlash(req, 'error', 'Could not add item: ' + err.message);
            res.redirect('/equipment');
        }
    }
);

router.get('/equipment/:tag/edit', isAuthenticated, requireAdmin, async (req, res) => {
    try {
        const [[item]] = await db.execute('SELECT * FROM equipment_inventory WHERE asset_tag = ?', [req.params.tag]);
        if (!item) {
            setFlash(req, 'error', 'Item not found.');
            return res.redirect('/equipment');
        }
        res.render('equipment-edit', { item });
    } catch (err) {
        console.error('Equipment edit load error:', err);
        res.status(500).send('Database Query Error');
    }
});

router.post('/equipment/:tag/edit', isAuthenticated, requireAdmin, async (req, res) => {
    const { item_name, category, serial_number, caliber, assigned_to } = req.body;
    const badge = (assigned_to || '').trim();

    try {
        const [[item]] = await db.execute('SELECT * FROM equipment_inventory WHERE asset_tag = ?', [req.params.tag]);
        if (!item) {
            setFlash(req, 'error', 'Item not found.');
            return res.redirect('/equipment');
        }

        if (badge && !/^\d+$/.test(badge)) {
            setFlash(req, 'error', 'Badge number must be numeric.');
            return res.redirect(`/equipment/${req.params.tag}/edit`);
        }

        let newBadge = badge ? Number(badge) : null;

        if (newBadge) {
            const [[officer]] = await db.execute('SELECT badge_number FROM officers WHERE badge_number = ?', [newBadge]);
            if (!officer) {
                setFlash(req, 'error', `No officer found with badge #${newBadge}.`);
                return res.redirect(`/equipment/${req.params.tag}/edit`);
            }
        }

        const oldBadge = item.assigned_to;
        const newStatus = item.status === 'Maintenance' ? 'Maintenance' : (newBadge ? 'Deployed' : 'Available');

        await db.execute(
            `UPDATE equipment_inventory SET item_name = ?, category = ?, serial_number = ?, caliber = ?,
                assigned_to = ?, status = ?
             WHERE asset_tag = ?`,
            [item_name, category || null, serial_number || null, caliber || null, newBadge, newStatus, req.params.tag]
        );

        if (oldBadge !== newBadge) {
            if (oldBadge) {
                await db.execute(
                    `UPDATE weapon_checkouts SET checked_in_at = CURRENT_TIMESTAMP
                     WHERE equipment_id = ? AND officer_badge = ? AND checked_in_at IS NULL`,
                    [item.id, oldBadge]
                );
            }
            if (newBadge) {
                await db.execute(
                    'INSERT INTO weapon_checkouts (equipment_id, officer_badge, notes) VALUES (?, ?, ?)',
                    [item.id, newBadge, `Assigned by ${req.session.adminName}`]
                );
            }
            await auditLog.record('EQUIPMENT_REASSIGNED', `${req.session.adminName} ${newBadge ? `assigned ${item.item_name} (${item.asset_tag}) to badge #${newBadge}` : `unassigned ${item.item_name} (${item.asset_tag})`}.`);
        }

        await auditLog.record('EQUIPMENT_UPDATED', `${req.session.adminName} updated ${req.params.tag}.`);
        setFlash(req, 'success', 'Item updated.');
        res.redirect('/equipment');
    } catch (err) {
        console.error('Equipment update error:', err);
        setFlash(req, 'error', 'Could not update item: ' + err.message);
        res.redirect(`/equipment/${req.params.tag}/edit`);
    }
});

router.post('/equipment/:tag/checkout', isAuthenticated, async (req, res) => {
    try {
        const [[item]] = await db.execute('SELECT * FROM equipment_inventory WHERE asset_tag = ?', [req.params.tag]);
        if (!item) {
            setFlash(req, 'error', 'Item not found.');
            return res.redirect('/equipment');
        }
        if (item.status !== 'Available') {
            setFlash(req, 'error', `${item.item_name} is not available for checkout.`);
            return res.redirect('/equipment');
        }

        await db.execute(
            'UPDATE equipment_inventory SET status = ?, assigned_to = ? WHERE asset_tag = ?',
            ['Deployed', req.session.userId, req.params.tag]
        );
        await db.execute(
            'INSERT INTO weapon_checkouts (equipment_id, officer_badge) VALUES (?, ?)',
            [item.id, req.session.userId]
        );
        await auditLog.record('EQUIPMENT_CHECKOUT', `${req.session.adminName} checked out ${item.item_name} (${item.asset_tag}).`);
        setFlash(req, 'success', `${item.item_name} checked out to you.`);
        res.redirect('/equipment');
    } catch (err) {
        console.error('Checkout error:', err);
        setFlash(req, 'error', 'Checkout failed: ' + err.message);
        res.redirect('/equipment');
    }
});

router.post('/equipment/:tag/checkin', isAuthenticated, async (req, res) => {
    try {
        const [[item]] = await db.execute('SELECT * FROM equipment_inventory WHERE asset_tag = ?', [req.params.tag]);
        if (!item) {
            setFlash(req, 'error', 'Item not found.');
            return res.redirect('/equipment');
        }

        await db.execute(
            'UPDATE equipment_inventory SET status = ?, assigned_to = NULL WHERE asset_tag = ?',
            ['Available', req.params.tag]
        );
        await db.execute(
            `UPDATE weapon_checkouts SET checked_in_at = CURRENT_TIMESTAMP
             WHERE equipment_id = ? AND officer_badge = ? AND checked_in_at IS NULL`,
            [item.id, req.session.userId]
        );
        await auditLog.record('EQUIPMENT_CHECKIN', `${req.session.adminName} returned ${item.item_name} (${item.asset_tag}).`);
        setFlash(req, 'success', `${item.item_name} returned to the armory.`);
        res.redirect('/equipment');
    } catch (err) {
        console.error('Checkin error:', err);
        setFlash(req, 'error', 'Check-in failed: ' + err.message);
        res.redirect('/equipment');
    }
});

router.post('/equipment/:tag/maintenance', isAuthenticated, requireAdmin, async (req, res) => {
    const { notes } = req.body;
    try {
        await db.execute(
            `UPDATE equipment_inventory SET status = 'Maintenance', assigned_to = NULL, last_inspected_at = DATE('now')
             WHERE asset_tag = ?`,
            [req.params.tag]
        );
        await auditLog.record('EQUIPMENT_MAINTENANCE', `${req.session.adminName} flagged ${req.params.tag} for maintenance. ${notes || ''}`.trim());
        setFlash(req, 'success', 'Item flagged for maintenance.');
        res.redirect('/equipment');
    } catch (err) {
        console.error('Maintenance flag error:', err);
        setFlash(req, 'error', 'Could not flag item: ' + err.message);
        res.redirect('/equipment');
    }
});

module.exports = router;
