ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role_level INTEGER NOT NULL DEFAULT 1;

UPDATE users SET role_level = 4 WHERE role = 'company_ceo';
UPDATE users SET role_level = 3 WHERE role = 'clinic_manager';
UPDATE users SET role_level = 2 WHERE role = 'clinic_worker';
UPDATE users SET role_level = 1 WHERE role = 'clinic_viewer';

ALTER TABLE users
    DROP COLUMN IF EXISTS role;

