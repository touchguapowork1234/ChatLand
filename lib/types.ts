export type Profile = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

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
