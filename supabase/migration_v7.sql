-- v7: Add updated_at to messages; ensure dm_messages reply columns exist
-- Safe to run even if v6 was already applied (all use IF NOT EXISTS)

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.dm_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.dm_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.dm_messages(id) ON DELETE SET NULL;
