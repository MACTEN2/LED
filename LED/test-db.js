require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        console.log("✅ [SYSTEM] CONNECTION SUCCESSFUL. DATABASE FOUND.");
        await connection.end();
    } catch (err) {
        console.error("❌ [SYSTEM] DATABASE NOT FOUND:", err.message);
    }
}
test();