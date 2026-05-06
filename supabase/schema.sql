-- ChatLand Database Schema
-- Run this in your Supabase SQL editor (https://supabase.com/dashboard/project/tnsvqdlaicjiaomqkirs/sql)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.servers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  icon        TEXT,
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.server_members (
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (server_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.channels (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id   UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages       ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Servers (all authenticated users can read — needed for invite code join flow)
CREATE POLICY "servers_select" ON public.servers
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "servers_insert" ON public.servers
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "servers_update" ON public.servers
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "servers_delete" ON public.servers
  FOR DELETE USING (auth.uid() = owner_id);

-- Server members
CREATE POLICY "members_select" ON public.server_members
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "members_insert" ON public.server_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members_delete" ON public.server_members
  FOR DELETE USING (auth.uid() = user_id);

-- Channels (only visible to server members)
CREATE POLICY "channels_select" ON public.channels
  FOR SELECT USING (
    server_id IN (
      SELECT server_id FROM public.server_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "channels_insert" ON public.channels
  FOR INSERT WITH CHECK (
    server_id IN (SELECT id FROM public.servers WHERE owner_id = auth.uid())
  );
CREATE POLICY "channels_delete" ON public.channels
  FOR DELETE USING (
    server_id IN (SELECT id FROM public.servers WHERE owner_id = auth.uid())
  );

-- Messages
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    channel_id IN (
      SELECT c.id FROM public.channels c
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE sm.user_id = auth.uid()
    )
  );
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    channel_id IN (
      SELECT c.id FROM public.channels c
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE sm.user_id = auth.uid()
    )
  );
CREATE POLICY "messages_delete" ON public.messages
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on signup (username extracted from email prefix)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, split_part(NEW.email, '@', 1));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-add owner as member + create #general when server is created
CREATE OR REPLACE FUNCTION public.handle_new_server()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.server_members (server_id, user_id) VALUES (NEW.id, NEW.owner_id);
  INSERT INTO public.channels (server_id, name) VALUES (NEW.id, 'general');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_server_created ON public.servers;
CREATE TRIGGER on_server_created
  AFTER INSERT ON public.servers
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_server();

-- ============================================================
-- REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
