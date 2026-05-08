-- AI Character feature

-- Track which users have redeemed AI access
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_ai_access boolean DEFAULT false;

-- Single-row table storing the shared AI character identity
CREATE TABLE IF NOT EXISTS ai_character (
  id         integer PRIMARY KEY DEFAULT 1,
  name       text NOT NULL DEFAULT 'Mako AI',
  avatar_url text DEFAULT NULL,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO ai_character (id, name) VALUES (1, 'Mako AI') ON CONFLICT DO NOTHING;

ALTER TABLE ai_character ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ai_character"
  ON ai_character FOR SELECT USING (true);

-- Only mako#0000 can update the AI character
CREATE POLICY "Only mako can update ai_character"
  ON ai_character FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND username = 'mako'
        AND tag = '0000'
    )
  );
