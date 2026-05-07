-- V13: Allow group owners to kick (delete) other members
CREATE POLICY "gm_owner_delete" ON public.group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_chats
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
  );
