-- V12: System messages in group chats (e.g. "user left the group")
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'message';
