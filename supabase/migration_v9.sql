-- V9: Fix infinite recursion in group_members RLS
-- The original gm_select policy referenced group_members from within group_members,
-- causing Supabase to loop endlessly and return empty results.

-- A SECURITY DEFINER function runs as the function owner, bypassing RLS inside it,
-- which breaks the recursion.
CREATE OR REPLACE FUNCTION public.is_group_member(gid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = gid AND user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "gm_select" ON public.group_members;
CREATE POLICY "gm_select" ON public.group_members FOR SELECT
  USING (public.is_group_member(group_id));
