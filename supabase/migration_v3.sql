-- V3: Set REPLICA IDENTITY FULL on realtime tables so server-side filters work
-- Run this in your Supabase SQL editor

ALTER TABLE public.calls           REPLICA IDENTITY FULL;
ALTER TABLE public.dm_messages     REPLICA IDENTITY FULL;
ALTER TABLE public.messages        REPLICA IDENTITY FULL;
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
