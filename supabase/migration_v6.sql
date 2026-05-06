-- V6: DM message edit tracking + reply threading
-- Run this in your Supabase SQL editor

ALTER TABLE public.dm_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.dm_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.dm_messages(id) ON DELETE SET NULL;
