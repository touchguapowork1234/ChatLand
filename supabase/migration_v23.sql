-- group_calls: one active call per group at a time
CREATE TABLE IF NOT EXISTS public.group_calls (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  started_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'active',   -- active | ended
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  ended_at   TIMESTAMPTZ
);
-- group_call_participants: who is currently in the call (deleted on leave)
CREATE TABLE IF NOT EXISTS public.group_call_participants (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id   UUID NOT NULL REFERENCES public.group_calls(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(call_id, user_id)
);

ALTER TABLE public.group_calls             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_call_participants ENABLE ROW LEVEL SECURITY;

-- group members can see/insert/update calls for their groups
CREATE POLICY "gcall_select" ON public.group_calls FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_calls.group_id AND user_id = auth.uid()));
CREATE POLICY "gcall_insert" ON public.group_calls FOR INSERT
  WITH CHECK (auth.uid() = started_by AND EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_calls.group_id AND user_id = auth.uid()));
CREATE POLICY "gcall_update" ON public.group_calls FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_calls.group_id AND user_id = auth.uid()));

-- participants: group members can see; own user can insert/delete
CREATE POLICY "gcallp_select" ON public.group_call_participants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.group_calls gc
    JOIN public.group_members gm ON gm.group_id = gc.group_id AND gm.user_id = auth.uid()
    WHERE gc.id = group_call_participants.call_id
  ));
CREATE POLICY "gcallp_insert" ON public.group_call_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gcallp_delete" ON public.group_call_participants FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE public.group_calls             REPLICA IDENTITY FULL;
ALTER TABLE public.group_call_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_call_participants;
