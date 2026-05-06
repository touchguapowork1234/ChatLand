-- V5: Allow users to edit their own messages
-- Run this in your Supabase SQL editor

CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "dmm_update" ON public.dm_messages
  FOR UPDATE USING (auth.uid() = sender_id);
