-- V16: Yasu Premium

-- Premium fields on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url    TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_primary TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_secondary TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS card_primary  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS card_secondary TEXT;

-- Premium codes (each code is single-use)
CREATE TABLE IF NOT EXISTS public.premium_codes (
  code        TEXT PRIMARY KEY,
  redeemed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ
);

ALTER TABLE public.premium_codes ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can look up a code (needed to validate before redeeming)
CREATE POLICY "pc_select" ON public.premium_codes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- A user can redeem only an unredeemed code and can only assign it to themselves
CREATE POLICY "pc_update" ON public.premium_codes FOR UPDATE
  USING  (redeemed_by IS NULL)
  WITH CHECK (redeemed_by = auth.uid());

-- Storage bucket for banner images
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "banners_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

CREATE POLICY "banners_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'banners' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "banners_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'banners' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
