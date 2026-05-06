-- V10: Mutual friends RPC
-- The client can't read another user's friend_requests due to RLS, so
-- mutual friend lookup is done in a SECURITY DEFINER function that runs
-- without RLS and returns only the intersection of two users' friend lists.

CREATE OR REPLACE FUNCTION public.get_mutual_friends(user_a UUID, user_b UUID)
RETURNS TABLE(friend_id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT a_friends.fid AS friend_id
  FROM (
    SELECT CASE WHEN sender_id = user_a THEN receiver_id ELSE sender_id END AS fid
    FROM public.friend_requests
    WHERE status = 'accepted'
      AND (sender_id = user_a OR receiver_id = user_a)
      AND CASE WHEN sender_id = user_a THEN receiver_id ELSE sender_id END != user_b
  ) a_friends
  WHERE a_friends.fid IN (
    SELECT CASE WHEN sender_id = user_b THEN receiver_id ELSE sender_id END
    FROM public.friend_requests
    WHERE status = 'accepted'
      AND (sender_id = user_b OR receiver_id = user_b)
      AND CASE WHEN sender_id = user_b THEN receiver_id ELSE sender_id END != user_a
  );
$$;
