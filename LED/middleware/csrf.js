// Double-submit-cookie CSRF protection (csrf-csrf). Bound to the express-session
// id, so the session must already be persisted (see app.js: saveUninitialized:true)
// before a token is issued, otherwise the id used to sign the GET-rendered token
// would differ from the id seen on the following POST.
const cookieParser = require('cookie-parser');
const { doubleCsrf } = require('csrf-csrf');

const { doubleCsrfProtection } = doubleCsrf({
    getSecret: () => process.env.SESSION_SECRET,
    getSessionIdentifier: (req) => req.session.id,
    // Server-rendered forms post the token as a hidden field, not a header
    // (the library's default assumes a fetch()-driven SPA).
    getCsrfTokenFromRequest: (req) => req.body && req.body._csrf,
    cookieName: 'led.csrf',
    cookieOptions: {
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
    },
});

// Makes the token available to every EJS view as `csrfToken` for embedding
// in forms as a hidden field.
const attachCsrfToken = (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
};

module.exports = { cookieParser, doubleCsrfProtection, attachCsrfToken };
