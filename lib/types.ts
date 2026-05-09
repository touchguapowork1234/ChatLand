export type Profile = {
  id: string
  username: string
  tag: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
  is_premium?: boolean
  is_admin?: boolean
  theme_enabled?: boolean
  card_enabled?: boolean
  banner_url?: string | null
  theme_primary?: string | null
  theme_secondary?: string | null
  card_primary?: string | null
  card_secondary?: string | null
  animations_enabled?: boolean
  anim_profile_fade?: boolean
  anim_chat_fade?: boolean
  anim_gradient?: boolean
  anim_hover_glow?: boolean
  anim_message_entrance?: boolean
  anim_smooth_transitions?: boolean
  profile_tilt_enabled?: boolean
  profile_bg_animation?: string | null
  profile_bg_opacity?: number | null
  profile_decoration?: string | null
  profile_glow_enabled?: boolean | null
  profile_glow_color?: string | null
  profile_glow_opacity?: number | null
  has_ai_access?: boolean
  hide_ai?: boolean
  sidebar_animation?: string | null
  profile_attachment?: string | null
  total_messages_sent?: number
  star_count?: number
  star_effect_expires_at?: string | null
  name_gradient_enabled?: boolean
  name_gradient_primary?: string | null
  name_gradient_secondary?: string | null
  name_gradient_in_chat?: boolean | null
  name_gradient_in_profile?: boolean | null
  name_gradient_moving?: boolean | null
}

export const userTag = (p?: Profile | null) =>
  p ? `${p.username}#${p.tag}` : ''

// Prefer display_name for showing names; fall back to username
export const displayName = (p?: Profile | null) =>
  p ? (p.display_name || p.username) : ''

export type Server = {
  id: string
  name: string
  icon: string | null
  owner_id: string
  invite_code: string
  created_at: string
}

export type Channel = {
  id: string
  server_id: string
  name: string
  description: string | null
  created_at: string
}

export type Message = {
  id: string
  channel_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  profiles?: Profile
}

export type FriendRequest = {
  id: string
  sender_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  sender?: Profile
  receiver?: Profile
}

export type DirectMessage = {
  id: string
  user1_id: string
  user2_id: string
  created_at: string
}

export type DmMessage = {
  id: string
  dm_id: string
  sender_id: string
  content: string
  created_at: string
  updated_at: string | null
  reply_to_id: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  profiles?: Profile
  failed?: boolean   // local-only flag for blocked send attempts
}

export type Block = {
  id: string
  blocker_id: string
  blocked_id: string
  created_at: string
}

export type GroupChat = {
  id: string
  name: string
  created_by: string
  created_at: string
  icon_url?: string | null
}

export type GroupMember = {
  id: string
  group_id: string
  user_id: string
  joined_at: string
  profiles?: Profile
}

export type GroupMessage = {
  id: string
  group_id: string
  sender_id: string
  content: string
  created_at: string
  updated_at: string | null
  reply_to_id: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  type: 'message' | 'system'
  profiles?: Profile
}

export type Call = {
  id: string
  caller_id: string
  receiver_id: string
  status: 'ringing' | 'active' | 'ended' | 'declined' | 'missed'
  offer: RTCSessionDescriptionInit | null
  answer: RTCSessionDescriptionInit | null
  created_at: string
  ended_at: string | null
}

export type GroupCall = {
  id: string
  group_id: string
  started_by: string
  status: 'active' | 'ended'
  started_at: string
  ended_at: string | null
}

export type GroupCallParticipant = {
  id: string
  call_id: string
  user_id: string
  joined_at: string
  profiles?: Profile
}
