-- LED polish pass: additive migration only.
-- Safe to run once against the existing database. Does not modify or drop
-- any existing column, table, type, or constraint.
--
-- Run with:
--   mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME> < 001_polish_features.sql

-- 1. Turn generic "equipment" rows into real armory/weapon records.
ALTER TABLE equipment_inventory
    ADD COLUMN category VARCHAR(50) NULL AFTER item_name,
    ADD COLUMN serial_number VARCHAR(100) NULL AFTER category,
    ADD COLUMN caliber VARCHAR(30) NULL AFTER serial_number,
    ADD COLUMN last_inspected_at DATE NULL AFTER caliber;

-- 2. Full checkout/return history for armory items (current state stays
--    cached on equipment_inventory.status / assigned_to for fast reads).
CREATE TABLE IF NOT EXISTS weapon_checkouts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipment_id INT NOT NULL,
    officer_badge INT NOT NULL,
    checked_out_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checked_in_at DATETIME NULL,
    notes VARCHAR(255) NULL,
    CONSTRAINT fk_checkout_equipment FOREIGN KEY (equipment_id)
        REFERENCES equipment_inventory(id),
    CONSTRAINT fk_checkout_officer FOREIGN KEY (officer_badge)
        REFERENCES officers(badge_number)
);

-- 3. Incident / long-form reports.
CREATE TABLE IF NOT EXISTS incident_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_number VARCHAR(30) NOT NULL UNIQUE,
    report_type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    narrative TEXT NOT NULL,
    location VARCHAR(150) NULL,
    occurred_at DATETIME NOT NULL,
    filed_by VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Open',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Officers tagged/involved on a report (many-to-many).
CREATE TABLE IF NOT EXISTS incident_report_officers (
    report_id INT NOT NULL,
    badge_number INT NOT NULL,
    PRIMARY KEY (report_id, badge_number),
    CONSTRAINT fk_report_officers_report FOREIGN KEY (report_id)
        REFERENCES incident_reports(id) ON DELETE CASCADE,
    CONSTRAINT fk_report_officers_officer FOREIGN KEY (badge_number)
        REFERENCES officers(badge_number)
);
