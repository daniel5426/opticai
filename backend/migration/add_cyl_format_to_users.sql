-- Migration: Add cyl_format to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS cyl_format VARCHAR DEFAULT 'minus';
