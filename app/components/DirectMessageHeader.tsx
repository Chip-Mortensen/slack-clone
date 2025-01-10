'use client'

import UserAvatar from './UserAvatar'
import { useName } from '../contexts/NameContext'
import type { Conversation } from '@/app/types/models'
import { useEffect } from 'react'

interface DirectMessageHeaderProps {
  conversation: Conversation
  onlineUsers?: string[]
}

export default function DirectMessageHeader({ conversation, onlineUsers = [] }: DirectMessageHeaderProps) {
  const { getUsername, loadUsername } = useName()
  const otherUserId = conversation.other_user.id.toString()

  useEffect(() => {
    loadUsername(otherUserId)
  }, [otherUserId, loadUsername])

  return (
    <div className="h-16 px-6 flex items-center border-b border-gray-200 bg-white">
      <div className="flex items-center">
        <UserAvatar
          userId={conversation.other_user.id}
          size="lg"
          showStatus={true}
          online={onlineUsers.includes(otherUserId)}
        />
        <span className="font-bold ml-2">
          {getUsername(otherUserId) || 'Unknown User'}
        </span>
      </div>
    </div>
  )
} 