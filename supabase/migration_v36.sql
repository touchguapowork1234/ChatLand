-- Inventory system: message count tracking, star balance, active effect
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_messages_sent integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS star_count integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS star_effect_expires_at timestamptz DEFAULT NULL;

-- Trigger function for server messages (user_id column)
CREATE OR REPLACE FUNCTION fn_award_star_server()
RETURNS TRIGGER AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE profiles
  SET total_messages_sent = total_messages_sent + 1
  WHERE id = NEW.user_id
  RETURNING total_messages_sent INTO new_count;

  IF new_count % 50 = 0 THEN
    UPDATE profiles SET star_count = star_count + 1 WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for DM and group messages (sender_id column)
CREATE OR REPLACE FUNCTION fn_award_star_dm()
RETURNS TRIGGER AS $$
DECLARE
  new_count integer;
BEGIN
  -- Skip system messages in group chats
  IF TG_TABLE_NAME = 'group_messages' AND NEW.type IS DISTINCT FROM 'message' THEN
    RETURN NEW;
  END IF;

  UPDATE profiles
  SET total_messages_sent = total_messages_sent + 1
  WHERE id = NEW.sender_id
  RETURNING total_messages_sent INTO new_count;

  IF new_count % 50 = 0 THEN
    UPDATE profiles SET star_count = star_count + 1 WHERE id = NEW.sender_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers
DROP TRIGGER IF EXISTS trg_award_star_server ON messages;
CREATE TRIGGER trg_award_star_server
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION fn_award_star_server();

DROP TRIGGER IF EXISTS trg_award_star_dm ON dm_messages;
CREATE TRIGGER trg_award_star_dm
  AFTER INSERT ON dm_messages
  FOR EACH ROW EXECUTE FUNCTION fn_award_star_dm();

DROP TRIGGER IF EXISTS trg_award_star_group ON group_messages;
CREATE TRIGGER trg_award_star_group
  AFTER INSERT ON group_messages
  FOR EACH ROW EXECUTE FUNCTION fn_award_star_dm();
