-- V14: Add reply_to_id to group_messages
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.group_messages(id) ON DELETE SET NULL;
