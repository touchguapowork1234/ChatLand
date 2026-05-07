-- V22: Group icon + name editing by any member

ALTER TABLE public.group_chats ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- Allow any member to update the group (name / icon)
DROP POLICY IF EXISTS "gc_update" ON public.group_chats;
CREATE POLICY "gc_update" ON public.group_chats FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = group_chats.id AND user_id = auth.uid()
  ));

-- Realtime delivery for group metadata changes
ALTER TABLE public.group_chats REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chats;
