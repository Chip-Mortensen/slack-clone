'use client'

import { useEffect, useRef } from 'react'
import type { Message, DirectMessage } from '@/app/types/models'
import MessageReactions from './MessageReactions'
import UserAvatar from './UserAvatar'
import MessageContent from './MessageContent'
import { useScrollManager } from '../hooks/useScrollManager'
import { useSupabase } from '../supabase-provider'
import { useState } from 'react'
import { MessageSquare } from 'lucide-react'

interface MessageListProps {
  messages: (Message | DirectMessage)[]
  hasMore: boolean
  loadMore: () => void
  loading: boolean
  onReplyClick?: (message: Message) => void
  showThreads?: boolean
  highlightedMessageId?: string | number | null
  isSearchNavigation?: boolean
  navigationSource: 'sidebar' | 'search' | null
  onlineUsers?: string[]
}

export default function MessageList({ 
  messages,
  hasMore,
  loadMore,
  loading,
  onReplyClick,
  showThreads,
  highlightedMessageId,
  isSearchNavigation,
  navigationSource,
  onlineUsers = []
}: MessageListProps) {
  const { supabase } = useSupabase()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const observerTarget = useRef<HTMLDivElement>(null)
  const previousMessagesLength = useRef(messages.length)
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({})
  
  const {
    state: scrollState,
    handleScroll,
    scrollToBottom,
    scrollToMessage,
    handleImageLoad,
    resetScrollState
  } = useScrollManager()

  // Add a ref to track if we're loading more messages
  const isLoadingMore = useRef(false)

  // Get current user
  useEffect(() => {
    async function getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    getCurrentUser()
  }, [supabase])

  // Handle navigation source changes
  useEffect(() => {
    resetScrollState(navigationSource)
    
    if (navigationSource === 'sidebar') {
      const container = containerRef.current
      if (container) {
        // Force immediate scroll with a more reliable approach
        const forceScrollToBottom = () => {
          const targetScroll = container.scrollHeight - container.clientHeight
          
          // First attempt
          scrollToBottom(container, { force: true, behavior: 'auto' })
          
          // Double-check in next frame to ensure scroll position
          requestAnimationFrame(() => {
            if (container.scrollTop !== targetScroll) {
              // If first attempt failed, force it directly
              container.scrollTop = targetScroll
              
              // Final check to ensure scroll position
              requestAnimationFrame(() => {
                if (container.scrollTop !== targetScroll) {
                  container.scrollTop = targetScroll
                }
              })
            }
          })
        }

        // Wait for any pending renders to complete
        requestAnimationFrame(forceScrollToBottom)
      }
    }
  }, [navigationSource, resetScrollState, scrollToBottom])

  // Handle new messages
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const isNewMessage = messages.length > previousMessagesLength.current
    
    // Only update if we're not loading more messages
    if (!isLoadingMore.current) {
      previousMessagesLength.current = messages.length

      // Only smooth scroll for new messages when we're not in search, not loading more, and at bottom
      if (isNewMessage && !isSearchNavigation && !scrollState.isInitialLoad && scrollState.shouldAutoScroll) {
        scrollToBottom(container, { behavior: 'smooth' })
      }
    }
  }, [messages.length, isSearchNavigation, scrollToBottom, scrollState.isInitialLoad, scrollState.shouldAutoScroll])

  // Handle highlighted message with cleanup
  useEffect(() => {
    const container = containerRef.current
    if (!container || !highlightedMessageId || !scrollState) return

    let timeoutId: NodeJS.Timeout
    let intervalId: NodeJS.Timeout

    if (isSearchNavigation) {
      const scrollToHighlightedMessage = () => {
        const messageElement = document.getElementById(`message-${highlightedMessageId}`)
        if (messageElement) {
          scrollToMessage(container, highlightedMessageId)
          if (intervalId) clearInterval(intervalId)
        }
      }

      // Try immediately
      scrollToHighlightedMessage()

      // If not found and we have more messages, load them
      if (!document.getElementById(`message-${highlightedMessageId}`) && hasMore) {
        loadMore()
        intervalId = setInterval(scrollToHighlightedMessage, 100)
        timeoutId = setTimeout(() => {
          if (intervalId) clearInterval(intervalId)
        }, 5000)
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [highlightedMessageId, isSearchNavigation, scrollToMessage, hasMore, loadMore, scrollState])

  // Fetch reply counts
  useEffect(() => {
    const fetchReplyCounts = async () => {
      if (!showThreads) return;
      
      const messageIds = messages
        .filter((m): m is Message => 'profiles' in m)
        .map(m => m.id);

      if (messageIds.length === 0) return;

      const { data, error } = await supabase
        .from('message_replies')
        .select('message_id')
        .in('message_id', messageIds);

      if (error) {
        console.error('Error fetching reply counts:', error);
        return;
      }

      const counts = data.reduce((acc: Record<string, number>, reply) => {
        acc[reply.message_id] = (acc[reply.message_id] || 0) + 1;
        return acc;
      }, {});

      setReplyCounts(counts);
    };

    fetchReplyCounts();
  }, [messages, showThreads, supabase]);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    const container = containerRef.current
    const target = observerTarget.current
    if (!container || !target) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          isLoadingMore.current = true
          loadMore()
        }
      },
      { 
        root: container,
        threshold: 0,
        rootMargin: '200px 0px'
      }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, loading, loadMore])

  // Reset loading state when loading completes
  useEffect(() => {
    if (!loading) {
      isLoadingMore.current = false
    }
  }, [loading])

  // Add back reaction handlers
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

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diffInHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return timestamp.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } else {
      return timestamp.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }
  }

  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Reset scroll state when component unmounts
      resetScrollState(null)
    }
  }, [resetScrollState])

  return (
    <div 
      ref={containerRef}
      onScroll={(e) => handleScroll(e.currentTarget)}
      className="flex-1 overflow-y-auto p-6 bg-white messages-container"
    >
      <div 
        ref={observerTarget}
        className="h-8 -mt-4"
        style={{ visibility: hasMore ? 'visible' : 'hidden' }}
      />

      {loading && messages.length > 0 && (
        <div className="text-center py-4">
          <span className="text-gray-500">Loading more messages...</span>
        </div>
      )}

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
              id={`message-${message.id}`}
              className={`flex items-start space-x-4 p-2 rounded-lg transition-colors duration-150
                ${highlightedMessageId === message.id 
                  ? 'bg-yellow-100' 
                  : 'hover:bg-gray-50'
                }`}
            >
              <UserAvatar
                userId={userId}
                avatarUrl={avatarUrl}
                username={username}
                size="lg"
                showStatus={true}
                online={onlineUsers?.includes(userId) || false}
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
                  onImageLoad={handleImageLoad}
                />
                <div className="flex items-center gap-1">
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
                  {showThreads && isChannelMessage && (
                    <button
                      onClick={() => onReplyClick?.(message as Message)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 flex items-center gap-1"
                    >
                      <MessageSquare size={16} />
                      {replyCounts[message.id] > 0 && (
                        <span className="mr-1 text-xs">{replyCounts[message.id]} replies</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
} 