-- Base armory/audit tables (these existed in the old MySQL schema with just
-- asset_tag/item_name/status/assigned_to + action_type/details/timestamp;
-- the extra columns below are the "polish pass" firearm-relevant fields).
-- Run against LED/db/db.db.

CREATE TABLE IF NOT EXISTS equipment_inventory (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_tag          TEXT NOT NULL UNIQUE,
    item_name          TEXT NOT NULL,
    category           TEXT,
    serial_number      TEXT,
    caliber            TEXT,
    last_inspected_at  TEXT,
    status             TEXT NOT NULL DEFAULT 'Available',
    assigned_to        TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    details     TEXT,
    timestamp   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
