-- v44: Add gradient name direction column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS name_gradient_direction text DEFAULT 'left';
