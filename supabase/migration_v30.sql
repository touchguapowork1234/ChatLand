ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_glow_enabled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_glow_color text DEFAULT '#5865f2';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_glow_opacity real DEFAULT 0.8;
