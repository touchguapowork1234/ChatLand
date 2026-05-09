-- Remove message-counting triggers (replaced by code redemption system)
DROP TRIGGER IF EXISTS trg_award_star_server ON messages;
DROP TRIGGER IF EXISTS trg_award_star_dm ON dm_messages;
DROP TRIGGER IF EXISTS trg_award_star_group ON group_messages;
DROP FUNCTION IF EXISTS fn_award_star_server();
DROP FUNCTION IF EXISTS fn_award_star_dm();
DROP FUNCTION IF EXISTS fn_award_star_group();

-- Item codes table
CREATE TABLE IF NOT EXISTS item_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  item_id text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  redeemed_by uuid REFERENCES profiles(id) DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE item_codes ENABLE ROW LEVEL SECURITY;

-- Only admins can generate codes
CREATE POLICY "Admins can insert item codes" ON item_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Authenticated users can read codes (needed to validate before redeeming)
CREATE POLICY "Users can view item codes" ON item_codes
  FOR SELECT TO authenticated
  USING (true);

-- Users can mark a code as redeemed by setting redeemed_by to their own id
CREATE POLICY "Users can redeem item codes" ON item_codes
  FOR UPDATE TO authenticated
  USING (redeemed_by IS NULL)
  WITH CHECK (redeemed_by = auth.uid());
