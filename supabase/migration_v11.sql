-- V11: Allow members to leave groups and owners to delete groups

-- Members can delete their own membership row (leave)
CREATE POLICY "gm_delete" ON public.group_members FOR DELETE
  USING (user_id = auth.uid());

-- Only the group owner can delete the group (cascades to members + messages)
CREATE POLICY "gc_delete" ON public.group_chats FOR DELETE
  USING (created_by = auth.uid());
