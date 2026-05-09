-- Recreate trigger functions with both exception safety AND working column references.
-- Columns are guaranteed to exist after v38. Exception handlers are kept so a trigger
-- failure never blocks a message send, but errors are now raised so they appear in
-- Supabase logs if something is still wrong.

CREATE OR REPLACE FUNCTION fn_award_star_server()
RETURNS TRIGGER AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.profiles
  SET total_messages_sent = COALESCE(total_messages_sent, 0) + 1
  WHERE id = NEW.user_id
  RETURNING total_messages_sent INTO new_count;

  IF new_count IS NOT NULL AND new_count > 0 AND new_count % 50 = 0 THEN
    UPDATE public.profiles
    SET star_count = COALESCE(star_count, 0) + 1
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_award_star_server error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION fn_award_star_dm()
RETURNS TRIGGER AS $$
DECLARE
  new_count integer;
BEGIN
  IF TG_TABLE_NAME = 'group_messages' AND NEW.type IS DISTINCT FROM 'message' THEN
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
  RAISE WARNING 'fn_award_star_dm error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
