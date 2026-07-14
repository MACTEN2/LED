-- Weapon/gear checkout history and the incident report module.
-- Run against LED/db/db.db.

CREATE TABLE IF NOT EXISTS weapon_checkouts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id    INTEGER NOT NULL REFERENCES equipment_inventory(id),
    officer_badge   INTEGER NOT NULL REFERENCES officers(badge_number),
    checked_out_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checked_in_at   TEXT,
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS incident_reports (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    report_number TEXT NOT NULL UNIQUE,
    report_type   TEXT NOT NULL,
    title         TEXT NOT NULL,
    narrative     TEXT NOT NULL,
    location      TEXT,
    occurred_at   TEXT NOT NULL,
    filed_by      TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'Open',
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident_report_officers (
    report_id    INTEGER NOT NULL REFERENCES incident_reports(id) ON DELETE CASCADE,
    badge_number INTEGER NOT NULL REFERENCES officers(badge_number),
    PRIMARY KEY (report_id, badge_number)
);
