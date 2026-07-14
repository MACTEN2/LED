const db = require('./db');

(async () => {
    try {
        const [rows] = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
        console.log('✅ [SYSTEM] CONNECTION SUCCESSFUL. Tables found:');
        rows.forEach((r) => console.log(`   - ${r.name}`));
    } catch (err) {
        console.error('❌ [SYSTEM] DATABASE ERROR:', err.message);
        process.exitCode = 1;
    }
})();
