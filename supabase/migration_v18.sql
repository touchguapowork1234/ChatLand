-- V18: Premium feature toggles

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS card_enabled  BOOLEAN NOT NULL DEFAULT true;
