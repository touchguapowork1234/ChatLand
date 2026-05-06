-- V8: Group chats

CREATE TABLE IF NOT EXISTS public.group_chats (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_messages (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.group_chats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- group_chats: members can read, authenticated users can insert (membership enforced in app)
CREATE POLICY "gc_select" ON public.group_chats FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_chats.id AND user_id = auth.uid()));

CREATE POLICY "gc_insert" ON public.group_chats FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- group_members: members can see all members of groups they belong to
CREATE POLICY "gm_select" ON public.group_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.group_members gm2 WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid()));

CREATE POLICY "gm_insert" ON public.group_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- group_messages: members can read and send; only sender can update
CREATE POLICY "gmsg_select" ON public.group_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid()));

CREATE POLICY "gmsg_insert" ON public.group_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
  );

CREATE POLICY "gmsg_update" ON public.group_messages FOR UPDATE
  USING (auth.uid() = sender_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
