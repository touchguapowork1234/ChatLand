-- Yasu Premium: Advanced Animations
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS animations_enabled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS anim_profile_fade boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS anim_chat_fade boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS anim_gradient boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS anim_hover_glow boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS anim_message_entrance boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS anim_smooth_transitions boolean DEFAULT false;
