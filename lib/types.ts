export type Profile = {
  id: string
  username: string
  tag: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
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
