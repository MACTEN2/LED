require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');

const { cookieParser, doubleCsrfProtection, attachCsrfToken } = require('./middleware/csrf');
const { readFlash } = require('./middleware/flash');
const codeRedState = require('./lib/codeRedState');

console.log("... [1] Modules Loaded");

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'"],
        },
    },
}));

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    // Must be true (not the original false): the CSRF double-submit token is
    // bound to the session id, so a session needs to exist and persist from
    // the very first GET (the login page) for that id to still match on the
    // POST that follows.
    saveUninitialized: true,
    cookie: { maxAge: 3600000 }, // Session expires in 1 hour
}));

app.use(doubleCsrfProtection);
app.use(attachCsrfToken);
app.use(readFlash);

// Common view data every authenticated page needs (sidebar/topbar/banner).
app.use((req, res, next) => {
    res.locals.adminName = req.session.adminName || null;
    res.locals.role = req.session.role || null;
    res.locals.badgeNumber = req.session.userId || null;
    res.locals.codeRed = codeRedState.get();
    res.locals.currentPath = req.path;
    next();
});

console.log("... [2] Middleware Configured");

app.use(require('./routes/auth'));
app.use(require('./routes/dashboard'));
app.use(require('./routes/officers'));
app.use(require('./routes/equipment'));
app.use(require('./routes/reports'));
app.use(require('./routes/codeRed'));

console.log("... [3] Routes Defined");

app.use((req, res) => {
    res.status(404).send('Not Found');
});

app.listen(port, () => {
    console.log(`\n====================================`);
    console.log(`[SYSTEM] LED Online: http://localhost:${port}`);
    console.log(`====================================\n`);
});
