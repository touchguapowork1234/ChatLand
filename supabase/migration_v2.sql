-- ============================================================
-- V2 Migration: Username Tags, Friends, DMs, Voice Calls
-- Run this in your Supabase SQL editor AFTER the original schema.sql
-- ============================================================

-- 1. Add tag column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tag TEXT;
UPDATE public.profiles SET tag = lpad((floor(random() * 9998) + 1)::text, 4, '0') WHERE tag IS NULL;
ALTER TABLE public.profiles ALTER COLUMN tag SET NOT NULL;

-- Drop old username unique constraint (username is no longer globally unique)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_tag_key UNIQUE (username, tag);

-- 2. Update handle_new_user trigger to assign a unique tag per username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username TEXT;
  v_tag      TEXT;
  v_tries    INT := 0;
BEGIN
  v_username := split_part(NEW.email, '@', 1);
  LOOP
    v_tag := lpad((floor(random() * 9998) + 1)::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE username = v_username AND tag = v_tag
    );
    v_tries := v_tries + 1;
    IF v_tries > 200 THEN
      RAISE EXCEPTION 'No available tag for username %', v_username;
    END IF;
  END LOOP;
  INSERT INTO public.profiles (id, username, tag) VALUES (NEW.id, v_username, v_tag);
  RETURN NEW;
END;
$$;

-- 3. Friend requests table
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_friend      CHECK (sender_id != receiver_id),
  CONSTRAINT unique_friend_pair  UNIQUE (sender_id, receiver_id)
);

-- 4. Direct message conversations
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dm_ordered CHECK (user1_id < user2_id),
  CONSTRAINT dm_unique  UNIQUE (user1_id, user2_id)
);

-- 5. DM messages
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dm_id      UUID NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Voice calls (offer/answer stored in DB for reliable WebRTC signaling)
CREATE TABLE IF NOT EXISTS public.calls (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caller_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','active','ended','declined','missed')),
  offer       JSONB,
  answer      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ
);

-- 7. ICE candidates (stored in DB so timing of subscriptions doesn't matter)
CREATE TABLE IF NOT EXISTS public.ice_candidates (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id    UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  from_user  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  candidate  JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ice_candidates   ENABLE ROW LEVEL SECURITY;

-- Friend requests
CREATE POLICY "fr_select" ON public.friend_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "fr_insert" ON public.friend_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "fr_update" ON public.friend_requests FOR UPDATE
  USING (auth.uid() = receiver_id);
CREATE POLICY "fr_delete" ON public.friend_requests FOR DELETE
  USING (auth.uid() = sender_id);

-- Direct messages
CREATE POLICY "dm_select" ON public.direct_messages FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "dm_insert" ON public.direct_messages FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- DM messages
CREATE POLICY "dmm_select" ON public.dm_messages FOR SELECT
  USING (dm_id IN (SELECT id FROM public.direct_messages WHERE user1_id = auth.uid() OR user2_id = auth.uid()));
CREATE POLICY "dmm_insert" ON public.dm_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND
    dm_id IN (SELECT id FROM public.direct_messages WHERE user1_id = auth.uid() OR user2_id = auth.uid()));

-- Calls
CREATE POLICY "calls_select" ON public.calls FOR SELECT
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);
CREATE POLICY "calls_insert" ON public.calls FOR INSERT
  WITH CHECK (auth.uid() = caller_id);
CREATE POLICY "calls_update" ON public.calls FOR UPDATE
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- ICE candidates
CREATE POLICY "ice_select" ON public.ice_candidates FOR SELECT
  USING (call_id IN (SELECT id FROM public.calls WHERE caller_id = auth.uid() OR receiver_id = auth.uid()));
CREATE POLICY "ice_insert" ON public.ice_candidates FOR INSERT
  WITH CHECK (auth.uid() = from_user AND
    call_id IN (SELECT id FROM public.calls WHERE caller_id = auth.uid() OR receiver_id = auth.uid()));

-- ============================================================
-- REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ice_candidates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
