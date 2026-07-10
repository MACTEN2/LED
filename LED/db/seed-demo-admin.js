// One-off seed script: creates (or resets) a demo Admin login so you always
// have a known-good way in. Safe to re-run — it upserts on badge_number.
// Remove this account (or change its password) before any real deployment.
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../db');

const DEMO_PASSWORD = 'Demo1234!';

const DEMO = {
    badge_number: 9000,
    post_id: 'DEMO',
    first_name: 'Demo',
    last_name: 'Admin',
    agency_name: 'Federal Bureau of Investigation',
    dob: '1990-01-01',
    work_email: 'demo.admin@led.local',
    officer_rank: 'Administrator',
    hire_date: new Date().toISOString().slice(0, 10),
    unit_division: 'System',
    duty_status: 'Active',
    role: 'Admin',
    created_by: 'System Seed',
};

(async () => {
    try {
        const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

        await db.execute(
            `INSERT INTO officers
                (badge_number, post_id, first_name, last_name, agency_name, dob,
                 work_email, officer_rank, hire_date, unit_division, duty_status,
                 password_hash, role, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                password_hash = VALUES(password_hash),
                role = VALUES(role),
                duty_status = VALUES(duty_status)`,
            [
                DEMO.badge_number, DEMO.post_id, DEMO.first_name, DEMO.last_name,
                DEMO.agency_name, DEMO.dob, DEMO.work_email, DEMO.officer_rank,
                DEMO.hire_date, DEMO.unit_division, DEMO.duty_status, hash,
                DEMO.role, DEMO.created_by,
            ]
        );

        console.log('\n=== Demo admin ready ===');
        console.log(`Badge Number: ${DEMO.badge_number}`);
        console.log(`Access Code:  ${DEMO_PASSWORD}`);
        console.log('========================\n');
        process.exit(0);
    } catch (err) {
        console.error('Seed failed:', err.message);
        process.exit(1);
    }
})();
