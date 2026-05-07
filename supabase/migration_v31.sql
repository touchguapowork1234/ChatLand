CREATE TABLE IF NOT EXISTS friend_nicknames (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  friend_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  nickname text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE friend_nicknames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own nicknames" ON friend_nicknames
  FOR ALL USING (auth.uid() = user_id);
