// Basic entity types
export interface Channel {
  id: string | number
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
  file_url?: string
  file_name?: string
  profiles: {
    username: string
    avatar_url: string | null
  }
  channels: {
    id: string | number
    name: string
  }
  reactions?: MessageReaction[]
}

export interface Profile {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  email: string
  updated_at: string
}

export interface Conversation {
  id: string | number
  created_at: string
  updated_at: string
  user1_id: string
  user2_id: string
  other_user: {
    id: string | number
    username: string
    avatar_url?: string
  }
}

export interface DirectMessage {
  id: number
  created_at: string
  message: string
  sender_id: string
  receiver_id: string
  file_url?: string
  file_name?: string
  sender: Profile
  conversation: {
    id: string | number
    user1_id: string
    user2_id: string
  }
  reactions?: MessageReaction[]
}

export interface MessageReaction {
  id: number
  message_id: number
  user_id: string
  emoji: string
  created_at: string
}

export interface MessageReply {
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