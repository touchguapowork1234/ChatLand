-- Required for Supabase Realtime to deliver postgres_changes events
-- when RLS is enabled on the table.
ALTER TABLE public.dm_messages    REPLICA IDENTITY FULL;
ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
