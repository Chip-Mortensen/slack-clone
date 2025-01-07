'use client'

import type { Message, DirectMessage } from '@/app/types'
import MessageReactions from './MessageReactions'
import UserAvatar from './UserAvatar'
import { useSupabase } from '../supabase-provider'
import { useEffect, useState, useRef } from 'react'
import { Paperclip } from 'lucide-react'
import MessageContent from './MessageContent'

interface MessageListProps {
  messages: (Message | DirectMessage)[]
  hasMore: boolean
  loadMore: () => void
  loading: boolean
}

export default function MessageList({ messages, hasMore, loadMore, loading }: MessageListProps) {
  const { supabase } = useSupabase()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<HTMLDivElement>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  const isNearBottom = () => {
    const container = containerRef.current
    if (container) {
      const { scrollHeight, scrollTop, clientHeight } = container
      return scrollHeight - scrollTop - clientHeight < 100
    }
    return false
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const container = containerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }

  // Handle scroll events to determine if we should auto-scroll
  const handleScroll = () => {
    setShouldAutoScroll(isNearBottom())
  }

  // Handle initial load and new messages
  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoad) {
        scrollToBottom('auto')
        setIsInitialLoad(false)
        setShouldAutoScroll(true)
      } else if (shouldAutoScroll) {
        scrollToBottom('smooth')
      }
    }
  }, [messages, isInitialLoad, shouldAutoScroll])

  // Reset states when channel changes
  useEffect(() => {
    setIsInitialLoad(true)
    setShouldAutoScroll(true)
  }, [messages.length === 0])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    console.log('Setting up observer with:', {
      hasMore,
      loading,
      containerExists: !!containerRef.current,
      targetExists: !!observerRef.current
    })

    const observer = new IntersectionObserver(
      (entries) => {
        console.log('Observer callback:', {
          isIntersecting: entries[0].isIntersecting,
          hasMore,
          loading,
          intersectionRatio: entries[0].intersectionRatio
        })

        if (entries[0].isIntersecting && hasMore && !loading) {
          console.log('Triggering loadMore')
          loadMore()
        }
      },
      { 
        root: containerRef.current,
        threshold: 0,
        rootMargin: '200px 0px'
      }
    )

    const target = observerRef.current
    if (target) {
      console.log('Observing target element')
      observer.observe(target)
    } else {
      console.log('No target element found')
    }

    return () => {
      if (target) {
        console.log('Cleaning up observer')
        observer.unobserve(target)
      }
    }
  }, [hasMore, loading, loadMore])

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
    
    if (isChannelMessage) {
      return {
        username: message.profiles.username,
        avatarUrl: message.profiles.avatar_url,
        content: message.content,
        timestamp: new Date(message.created_at),
        isChannelMessage: true,
        fileUrl: message.file_url,
        fileName: message.file_name
      }
    }
    
    return {
      username: message.sender?.username || 'Unknown User',
      avatarUrl: message.sender?.avatar_url,
      content: message.message,
      timestamp: new Date(message.created_at),
      isChannelMessage: false,
      fileUrl: message.file_url,
      fileName: message.file_name
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
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-6 bg-white messages-container"
    >
      {/* Loading indicator */}
      {loading && messages.length > 0 && (
        <div className="text-center py-4">
          <span className="text-gray-500">Loading more messages...</span>
        </div>
      )}

      {/* Observer target at the top */}
      <div 
        ref={observerRef} 
        className="h-8 -mt-4"
        style={{ visibility: hasMore ? 'visible' : 'hidden' }}
      />

      <div className="space-y-1">
        {messages.map((message) => {
          const { 
            username, 
            avatarUrl, 
            content, 
            timestamp, 
            isChannelMessage,
            fileUrl,
            fileName 
          } = getMessageDisplay(message)
          
          const userId = isChannelMessage 
            ? (message as Message).user_id 
            : (message as DirectMessage).sender_id

          return (
            <div 
              key={message.id} 
              className="flex items-start space-x-4 p-2 rounded-lg hover:bg-gray-50 transition-colors duration-150"
            >
              <UserAvatar
                userId={userId}
                avatarUrl={avatarUrl}
                username={username}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-gray-900">
                    {username}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatTimestamp(timestamp)}
                  </span>
                </div>
                <MessageContent 
                  content={content}
                  fileUrl={fileUrl}
                  fileName={fileName}
                />
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
      <div ref={messagesEndRef} />
    </div>
  )
} 