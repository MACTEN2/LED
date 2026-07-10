const express = require('express');
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');
const codeRedState = require('../lib/codeRedState');

const router = express.Router();

router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const [[equipmentCounts]] = await db.execute(`
            SELECT
                COUNT(*) AS total,
                SUM(status = 'Available') AS available,
                SUM(status = 'Deployed') AS deployed,
                SUM(status = 'Maintenance') AS maintenance
            FROM equipment_inventory
        `);

        const [[officerCounts]] = await db.execute(`
            SELECT
                COUNT(*) AS total,
                SUM(duty_status = 'Active') AS active
            FROM officers
        `);

        const [[reportCounts]] = await db.execute(`
            SELECT SUM(status = 'Open') AS open, SUM(status = 'Pending Review') AS pending
            FROM incident_reports
        `);

        const [logs] = await db.execute('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 10');

        let onDutyOfficers = [];
        let availableGear = [];
        if (codeRedState.get().active) {
            [onDutyOfficers] = await db.execute(
                "SELECT badge_number, first_name, last_name, unit_division FROM officers WHERE duty_status = 'Active' ORDER BY last_name LIMIT 25"
            );
            [availableGear] = await db.execute(
                "SELECT asset_tag, item_name, category FROM equipment_inventory WHERE status = 'Available' ORDER BY item_name LIMIT 25"
            );
        }

        res.render('dashboard', {
            equipmentCounts, officerCounts, reportCounts, logs, onDutyOfficers, availableGear,
        });
    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).send('Database Query Error');
    }
});

module.exports = router;
