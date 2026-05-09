-- Harden inventory triggers so they never block message inserts.
-- Any error inside the star-awarding logic is silently swallowed;
-- the INSERT on the message table always succeeds.

CREATE OR REPLACE FUNCTION fn_award_star_server()
RETURNS TRIGGER AS $$
DECLARE
  new_count integer;
BEGIN
  BEGIN
    UPDATE profiles
    SET total_messages_sent = total_messages_sent + 1
    WHERE id = NEW.user_id
    RETURNING total_messages_sent INTO new_count;

    IF new_count IS NOT NULL AND new_count > 0 AND new_count % 50 = 0 THEN
      UPDATE profiles SET star_count = star_count + 1 WHERE id = NEW.user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block the message send
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_award_star_dm()
RETURNS TRIGGER AS $$
DECLARE
  new_count integer;
BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block the message send
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
