-- Ensure inventory columns exist (safe to run even if v36 was already applied)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_messages_sent integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS star_count integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS star_effect_expires_at timestamptz DEFAULT NULL;

-- Recreate trigger functions now that columns are guaranteed to exist
CREATE OR REPLACE FUNCTION fn_award_star_server()
RETURNS TRIGGER AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE profiles
  SET total_messages_sent = total_messages_sent + 1
  WHERE id = NEW.user_id
  RETURNING total_messages_sent INTO new_count;

  IF new_count IS NOT NULL AND new_count > 0 AND new_count % 50 = 0 THEN
    UPDATE profiles SET star_count = star_count + 1 WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_award_star_dm()
RETURNS TRIGGER AS $$
DECLARE
  new_count integer;
BEGIN
  IF TG_TABLE_NAME = 'group_messages' AND NEW.type IS DISTINCT FROM 'message' THEN
    RETURN NEW;
  END IF;

  UPDATE profiles
  SET total_messages_sent = total_messages_sent + 1
  WHERE id = NEW.sender_id
  RETURNING total_messages_sent INTO new_count;

  IF new_count IS NOT NULL AND new_count > 0 AND new_count % 50 = 0 THEN
    UPDATE profiles SET star_count = star_count + 1 WHERE id = NEW.sender_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers (drop first to avoid duplicates)
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
