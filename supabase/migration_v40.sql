-- Split fn_award_star_dm into two separate functions so dm_messages never
-- tries to access NEW.type (a column that only exists on group_messages).

CREATE OR REPLACE FUNCTION fn_award_star_dm()
RETURNS TRIGGER AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.profiles
  SET total_messages_sent = COALESCE(total_messages_sent, 0) + 1
  WHERE id = NEW.sender_id
  RETURNING total_messages_sent INTO new_count;

  IF new_count IS NOT NULL AND new_count > 0 AND new_count % 50 = 0 THEN
    UPDATE public.profiles
    SET star_count = COALESCE(star_count, 0) + 1
    WHERE id = NEW.sender_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_award_star_dm error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION fn_award_star_group()
RETURNS TRIGGER AS $$
DECLARE
  new_count integer;
BEGIN
  -- Only count real messages, not system events
  IF NEW.type IS DISTINCT FROM 'message' THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET total_messages_sent = COALESCE(total_messages_sent, 0) + 1
  WHERE id = NEW.sender_id
  RETURNING total_messages_sent INTO new_count;

  IF new_count IS NOT NULL AND new_count > 0 AND new_count % 50 = 0 THEN
    UPDATE public.profiles
    SET star_count = COALESCE(star_count, 0) + 1
    WHERE id = NEW.sender_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_award_star_group error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Reattach triggers with the correct dedicated functions
DROP TRIGGER IF EXISTS trg_award_star_dm ON dm_messages;
CREATE TRIGGER trg_award_star_dm
  AFTER INSERT ON dm_messages
  FOR EACH ROW EXECUTE FUNCTION fn_award_star_dm();

DROP TRIGGER IF EXISTS trg_award_star_group ON group_messages;
CREATE TRIGGER trg_award_star_group
  AFTER INSERT ON group_messages
  FOR EACH ROW EXECUTE FUNCTION fn_award_star_group();
