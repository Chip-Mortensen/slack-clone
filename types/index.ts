export interface Channel {
  id: number
  name: string
  created_at: string
  created_by: string
}

export interface Message {
  id: number
  content: string
  created_at: string
  user_id: string
  channel_id: number
  profiles: {
    username: string
    avatar_url: string | null
  }
} 