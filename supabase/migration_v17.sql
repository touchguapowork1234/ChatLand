-- V17: Admin system + premium code generation

-- Add is_admin to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Add created_at to premium_codes so we can sort them
ALTER TABLE public.premium_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Grant mako#0000 admin
UPDATE public.profiles SET is_admin = true WHERE LOWER(username) = 'mako' AND tag = '0000';

-- Allow admins to insert new premium codes
CREATE POLICY "admin_insert_codes" ON public.premium_codes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
