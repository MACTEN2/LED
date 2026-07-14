require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');

// Local file DB — sidesteps the free MySQL host's repeated outages/access
// issues entirely. Override the path with SQLITE_PATH if you ever need to
// point at a different file (e.g. a test database).
const dbPath = process.env.SQLITE_PATH || path.join(__dirname, 'db', 'db.db');
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// better-sqlite3 is synchronous; this adapter wraps it to match the shape of
// the mysql2 promise pool API the app was originally written against
// (`const [rows] = await db.execute(sql, params)`), so route files didn't
// need to be rewritten statement-by-statement when we switched drivers.
function runStatement(sql, params = []) {
    const stmt = sqlite.prepare(sql);
    if (stmt.reader) {
        return [stmt.all(...params)];
    }
    const info = stmt.run(...params);
    return [{ insertId: info.lastInsertRowid, affectedRows: info.changes }];
}

async function execute(sql, params = []) {
    return runStatement(sql, params);
}

// mysql2's pool.getConnection() is used by routes/reports.js for a
// transaction. SQLite has a single writer, so this just wraps the same
// underlying handle in BEGIN/COMMIT/ROLLBACK.
async function getConnection() {
    return {
        execute: async (sql, params = []) => runStatement(sql, params),
        beginTransaction: async () => { sqlite.exec('BEGIN'); },
        commit: async () => { sqlite.exec('COMMIT'); },
        rollback: async () => { sqlite.exec('ROLLBACK'); },
        release: () => {},
    };
}

module.exports = { execute, getConnection };
