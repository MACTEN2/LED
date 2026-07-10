// Per-badge (not per-IP) brute-force lockout. Precinct networks share a single
// public IP via NAT, so IP-based limiting would lock out an entire station;
// gating on the badge number being attacked avoids that while still stopping
// credential-stuffing against one account.

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;

const attempts = new Map(); // badge_number -> { count, lockedUntil }

function isLocked(badgeNumber) {
    const entry = attempts.get(badgeNumber);
    if (!entry || !entry.lockedUntil) return false;
    if (Date.now() >= entry.lockedUntil) {
        attempts.delete(badgeNumber);
        return false;
    }
    return true;
}

function remainingLockSeconds(badgeNumber) {
    const entry = attempts.get(badgeNumber);
    if (!entry || !entry.lockedUntil) return 0;
    return Math.max(0, Math.ceil((entry.lockedUntil - Date.now()) / 1000));
}

function recordFailure(badgeNumber) {
    const entry = attempts.get(badgeNumber) || { count: 0, lockedUntil: null };
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) {
        entry.lockedUntil = Date.now() + LOCKOUT_MS;
    }
    attempts.set(badgeNumber, entry);
}

function recordSuccess(badgeNumber) {
    attempts.delete(badgeNumber);
}

module.exports = { isLocked, remainingLockSeconds, recordFailure, recordSuccess };
