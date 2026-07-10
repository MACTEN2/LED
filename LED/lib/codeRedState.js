// In-memory singleton for the app-wide "Code Red" emergency mode.
// A process restart clears the "currently active" flag, but every
// activation/resolution is also written to audit_log by the route
// handler, so the history itself is never lost.

let state = { active: false, activatedBy: null, activatedAt: null };

function get() {
    return state;
}

function activate(activatedBy) {
    state = { active: true, activatedBy, activatedAt: new Date() };
    return state;
}

function resolve() {
    state = { active: false, activatedBy: null, activatedAt: null };
    return state;
}

module.exports = { get, activate, resolve };
