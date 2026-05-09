ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name_gradient_enabled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name_gradient_primary text DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name_gradient_secondary text DEFAULT NULL;
