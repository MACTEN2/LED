-- SQLite schema for the Officers table, matching the columns already used
-- throughout the app's routes/views (routes/officers.js, routes/auth.js,
-- views/officers.ejs, views/officer-detail.ejs, views/officer-edit.ejs).
-- Run against LED/db/db.db.

CREATE TABLE IF NOT EXISTS officers (
    badge_number   INTEGER PRIMARY KEY,
    post_id        TEXT,
    first_name     TEXT NOT NULL,
    last_name      TEXT NOT NULL,
    agency_name    TEXT NOT NULL,
    dob            TEXT,
    work_email     TEXT NOT NULL,
    officer_rank   TEXT,
    hire_date      TEXT,
    unit_division  TEXT,
    duty_status    TEXT NOT NULL DEFAULT 'Active',
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'User',
    created_by     TEXT,
    created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
