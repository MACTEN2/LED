-- Switches equipment_inventory.assigned_to from a free-text display name to
-- the officer's badge_number (INTEGER, FK to officers), so "Assigned To" is
-- an actual link to a personnel record instead of an arbitrary string.
-- SQLite can't ALTER a column's type in place, so this recreates the table.
BEGIN TRANSACTION;

ALTER TABLE equipment_inventory RENAME TO equipment_inventory_old;

CREATE TABLE equipment_inventory (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_tag          TEXT NOT NULL UNIQUE,
    item_name          TEXT NOT NULL,
    category           TEXT,
    serial_number      TEXT,
    caliber            TEXT,
    last_inspected_at  TEXT,
    status             TEXT NOT NULL DEFAULT 'Available',
    assigned_to        INTEGER REFERENCES officers(badge_number)
);

INSERT INTO equipment_inventory (id, asset_tag, item_name, category, serial_number, caliber, last_inspected_at, status, assigned_to)
SELECT id, asset_tag, item_name, category, serial_number, caliber, last_inspected_at, status,
       CASE WHEN typeof(assigned_to) = 'integer' THEN assigned_to ELSE NULL END
FROM equipment_inventory_old;

DROP TABLE equipment_inventory_old;

COMMIT;
