-- Yasu Premium: Public Profile options
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_tilt_enabled boolean DEFAULT false;
