-- Yasu Premium: Profile Decorations
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_decoration text DEFAULT NULL;
