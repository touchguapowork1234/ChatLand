-- Hide AI chatbots from DMs list preference
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hide_ai boolean DEFAULT false;
