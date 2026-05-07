-- V15: File sharing (images + audio) in DMs and group chats

-- File columns on dm_messages
ALTER TABLE public.dm_messages ADD COLUMN IF NOT EXISTS file_url  TEXT;
ALTER TABLE public.dm_messages ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.dm_messages ADD COLUMN IF NOT EXISTS file_type TEXT;

-- File columns on group_messages
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS file_url  TEXT;
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Delete policy for dm_messages (needed for file cleanup)
CREATE POLICY "dm_msg_delete" ON public.dm_messages FOR DELETE
  USING (auth.uid() = sender_id);

-- Delete policy for group_messages
CREATE POLICY "gmsg_delete" ON public.group_messages FOR DELETE
  USING (auth.uid() = sender_id);

-- Storage bucket (public so image URLs are directly accessible)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone authenticated can read (bucket is public, but belt-and-suspenders)
CREATE POLICY "chat_files_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-files');

-- Users can only upload into their own folder (path starts with their user id)
CREATE POLICY "chat_files_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only delete files in their own folder
CREATE POLICY "chat_files_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
