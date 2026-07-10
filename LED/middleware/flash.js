// One-shot session flash messages. Replaces the old res.send("<script>alert(...)</script>")
// pattern with a real banner rendered by views/partials/flash.ejs.

const setFlash = (req, type, message) => {
    req.session.flash = { type, message };
};

// Reads and clears any pending flash message into res.locals for the current render.
const readFlash = (req, res, next) => {
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;
    next();
};

module.exports = { setFlash, readFlash };
