import type { User } from '@supabase/auth-helpers-nextjs'

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

export interface Profile {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  email: string
  updated_at: string
}

// Add any other types you might need
export interface AuthUser extends User {
  user_metadata: {
    username?: string
  }
}

export interface Conversation {
  id: number
  created_at: string
  updated_at: string
  user1_id: string
  user2_id: string
  other_user: Profile // Will be joined from profiles table
}

export interface DirectMessage {
  id: number
  created_at: string
  message: string
  sender_id: string
  receiver_id: string
  sender: Profile
}

interface MessageReply {
  id: number
  message_id: number
  user_id: string
  content: string
  created_at: string
  file_url?: string
  file_name?: string
  profiles: Profile
  reactions?: MessageReaction[]
} 