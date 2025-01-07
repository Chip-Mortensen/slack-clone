'use client'

import type { Message, DirectMessage } from '@/app/types'
import MessageReactions from './MessageReactions'
import { useSupabase } from '../supabase-provider'
import { useEffect, useState } from 'react'

interface MessageListProps {
  messages: (Message | DirectMessage)[]
}

export default function MessageList({ messages }: MessageListProps) {
  const { supabase } = useSupabase()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    async function getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    getCurrentUser()
  }, [supabase])

  const getMessageDisplay = (message: Message | DirectMessage) => {
    const isChannelMessage = 'profiles' in message
    
    const username = isChannelMessage 
      ? message.profiles.username 
      : message.sender.username
    
    const avatarUrl = isChannelMessage 
      ? message.profiles.avatar_url 
      : message.sender.avatar_url
    
    const content = isChannelMessage 
      ? message.content 
      : message.message

    return {
      username,
      avatarUrl,
      content,
      timestamp: new Date(message.created_at),
      isChannelMessage
    }
  }

  const handleAddReaction = async (messageId: string | number, isDirectMessage: boolean, emoji: string) => {
    if (!currentUserId) return

    try {
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: isDirectMessage ? null : messageId,
          direct_message_id: isDirectMessage ? messageId : null,
          user_id: currentUserId,
          emoji
        })

      if (error) throw error
    } catch (error) {
      console.error('Error adding reaction:', error)
    }
  }

  const handleRemoveReaction = async (reactionId: string | number) => {
    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('id', reactionId)

      if (error) throw error
    } catch (error) {
      console.error('Error removing reaction:', error)
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diffInHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      // Same day, show only time
      return timestamp.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } else {
      // Different day, show date and time
      return timestamp.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-white messages-container">
      <div className="space-y-1">
        {messages.map((message) => {
          const { username, avatarUrl, content, timestamp, isChannelMessage } = getMessageDisplay(message)
          
          return (
            <div 
              key={message.id} 
              className="flex items-start space-x-4 p-2 rounded-lg hover:bg-gray-50 transition-colors duration-150"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-lg bg-gray-200 overflow-hidden">
                  {avatarUrl && (
                    <img
                      src={avatarUrl}
                      alt={username}
                      className="w-12 h-12 object-cover"
                      onError={(e) => {
                        console.error('Error loading image:', e)
                        e.currentTarget.src = ''
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-gray-900">
                    {username}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatTimestamp(timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-gray-900 whitespace-pre-wrap break-words">
                  {content}
                </p>
                {currentUserId && (
                  <MessageReactions
                    messageId={message.id}
                    isDirectMessage={!isChannelMessage}
                    reactions={message.reactions || []}
                    currentUserId={currentUserId}
                    onAddReaction={(emoji) => handleAddReaction(message.id, !isChannelMessage, emoji)}
                    onRemoveReaction={handleRemoveReaction}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
} 