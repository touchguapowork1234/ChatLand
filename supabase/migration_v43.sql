-- v43: Add gradient name sub-toggle columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS name_gradient_in_chat    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS name_gradient_in_profile boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS name_gradient_moving     boolean DEFAULT false;
