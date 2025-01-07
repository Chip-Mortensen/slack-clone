export interface Profile {
  id: string
  username: string
  avatar_url: string | null
}

export interface Reaction {
  id: string | number
  emoji: string
  user_id: string
  message_id?: string | number
  direct_message_id?: string | number
  created_at: string
}

export interface Message {
  id: string | number
  content: string
  created_at: string
  user_id: string
  channel_id: string | number
  profiles: Profile
  reactions?: Reaction[]
  file_url?: string
  file_name?: string
  reply_count?: number;
}

export interface DirectMessage {
  id: string | number
  message: string
  created_at: string
  sender_id: string
  receiver_id: string
  conversation_id: number
  sender: Profile
  reactions?: Reaction[]
  file_url?: string
  file_name?: string
}

export interface MessageReply {
  id: string
  message_id: string
  content: string
  user_id: string
  created_at: string
  profiles: Profile
  file_url?: string
  file_name?: string
}

export type UserStatus = {
  id: string
  user_id: string
  status_type: 'in_meeting' | 'commuting'
  expires_at: string
  created_at: string
} 