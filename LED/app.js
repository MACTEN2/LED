const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db'); 
const session = require('express-session');

console.log("... [1] Modules Loaded");

const app = express();
const port = 3000;
const bcrypt = require('bcrypt');

const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next(); // User is logged in, proceed to the dashboard
    }
    res.redirect('/'); // Not logged in, redirect to login
};

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 } // Session expires in 1 hour
}));

// 🟢 FIX: Line 10 (the floating await) has been removed. 
// Database logic must stay inside the route handlers below.

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

console.log("... [2] Middleware Configured");

// Root Route
app.get('/', (req, res) => {
    res.render('login');
});

// Login Route - Secured with Bcrypt
app.post('/login', async (req, res) => {
    const { badge_number, password } = req.body;
    try {
        const [rows] = await db.execute('SELECT * FROM officers WHERE badge_number = ?', [badge_number]);

        if (rows.length > 0) {
            const officer = rows[0]; // Define the officer object from the database result
            const match = await require('bcrypt').compare(password, officer.password_hash);
            
            if (match) {
                // --- UPDATED LOGIC STARTS HERE ---
                // We store identifying info in the session "envelope"
                req.session.userId = officer.badge_number;
                req.session.adminName = `${officer.first_name} ${officer.last_name}`;
                req.session.role = officer.role;

                console.log(`[SESSION] Started for: ${req.session.adminName}`);
                res.redirect('/dashboard');
                // --- UPDATED LOGIC ENDS HERE ---
            } else {
                res.send("<script>alert('INVALID CREDENTIALS'); window.location='/';</script>");
            }
        } else {
            res.send("<script>alert('ACCESS DENIED'); window.location='/';</script>");
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Security System Failure");
    }
});

// Dashboard Route
app.get('/dashboard', isAuthenticated, async (req, res) => {
    const activeTab = req.query.tab || 'inventory';

    try {
        // Fetch current equipment state
        const [inventory] = await db.execute('SELECT * FROM equipment_inventory');
        
        // Fetch recent logs for the audit trail
        const [logs] = await db.execute('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 10');
        
        // 🟢 Fetching full officer details securely inside the async block
        // Matching Screenshot 2026-05-04 at 12.16.17.png
        const [officers] = await db.execute(`
            SELECT 
                badge_number, post_id, first_name, last_name, agency_name, 
                dob, work_email, officer_rank, hire_date, unit_division, 
                duty_status, created_by, created_at, role 
            FROM officers
        `);

        res.render('dashboard', { 
            activeTab: activeTab,
            inventory: inventory,
            officers: officers,
            logs: logs,
            adminName: "M. CORACHEA" 
        });
    } catch (err) {
        console.error("Dashboard Error:", err);
        res.status(500).send("Database Query Error");
    }
});

console.log("... [3] Routes Defined");

app.listen(port, () => {
    console.log(`\n====================================`);
    console.log(`[SYSTEM] LED Online: http://localhost:${port}`);
    console.log(`====================================\n`);
}); 
//-------------------------------------------------------------------//
// Add-Officer page

// 1. Show the Form (Protected)
app.get('/add-officer', isAuthenticated, (req, res) => {
    res.render('add-officer');
});

// 2. Process the New Officer
app.post('/add-officer', isAuthenticated, async (req, res) => {
    // 1. Check your terminal/console for the SPECIFIC error message first!
    const { 
        badge_number, post_id, first_name, last_name, 
        agency_name, dob, work_email, officer_rank, 
        hire_date, unit_division, password, role 
    } = req.body;

    const bcrypt = require('bcrypt');

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Ensure every column name here matches your 'DESC officers;' output exactly
        const sql = `INSERT INTO officers 
            (badge_number, post_id, first_name, last_name, agency_name, dob, 
             work_email, officer_rank, hire_date, unit_division, 
             password_hash, role, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        // The order here must match the order in the SQL string above
        await db.execute(sql, [
            badge_number || null, 
            post_id || null, 
            first_name, 
            last_name, 
            agency_name || 'Federal Bureau of Investigation', 
            dob || null, 
            work_email || null, 
            officer_rank || null, 
            hire_date || null, 
            unit_division || null, 
            hashedPassword, 
            role || 'User', 
            req.session.adminName // Authenticated admin from session
        ]);

        res.redirect('/dashboard');
    } catch (err) {
        // THIS IS THE IMPORTANT PART: Look at your terminal to see what this prints!
        console.error("DETAILED DATABASE ERROR:", err.message);
        res.status(500).send("Error deploying personnel to database: " + err.message);
    }
});