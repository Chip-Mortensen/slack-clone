'use client'

import UserAvatar from './UserAvatar'
import type { Conversation } from '@/app/types/models'

interface DirectMessageHeaderProps {
  conversation: Conversation
}

export default function DirectMessageHeader({ conversation }: DirectMessageHeaderProps) {
  return (
    <div className="h-16 px-6 flex items-center border-b border-gray-200 bg-white">
      <div className="flex items-center">
        <UserAvatar
          userId={conversation.other_user.id}
          avatarUrl={conversation.other_user.avatar_url}
          username={conversation.other_user.username}
          size="md"
        />
        <span className="font-medium ml-2">
          {conversation.other_user.username}
        </span>
      </div>
    </div>
  )
} 