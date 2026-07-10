const db = require('../db');

// Best-effort audit trail write. Assumes audit_log.timestamp defaults to
// CURRENT_TIMESTAMP (matches the existing ORDER BY timestamp DESC query in
// the original app.js) - action_type/details are the only columns the
// original code ever read, so they're the only ones written here.
async function record(actionType, details) {
    try {
        await db.execute(
            'INSERT INTO audit_log (action_type, details) VALUES (?, ?)',
            [actionType, details]
        );
    } catch (err) {
        console.error('[AUDIT] Failed to record entry:', err.message);
    }
}

module.exports = { record };
