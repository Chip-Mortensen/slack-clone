'use client'

import type { Message, DirectMessage } from '@/app/types'
import MessageReactions from './MessageReactions'
import UserAvatar from './UserAvatar'
import { useSupabase } from '../supabase-provider'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Paperclip, MessageSquare } from 'lucide-react'
import MessageContent from './MessageContent'

interface MessageListProps {
  messages: (Message | DirectMessage)[]
  hasMore: boolean
  loadMore: () => void
  loading: boolean
  onReplyClick?: (message: Message) => void
  showThreads?: boolean
}

export default function MessageList({ messages, hasMore, loadMore, loading, onReplyClick, showThreads }: MessageListProps) {
  const { supabase } = useSupabase()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const previousMessagesLength = useRef(messages.length)
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({})
  const isInitialLoad = useRef(true)

  // Add a ref for the observer target
  const observerTarget = useRef<HTMLDivElement>(null)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // Check if user is near bottom when scrolling
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    const buffer = 100 // pixels from bottom to consider "near bottom"
    const isClose = scrollHeight - scrollTop - clientHeight < buffer
    setIsNearBottom(isClose)
    setShouldAutoScroll(isClose) // Only auto-scroll for new messages if user is near bottom
  }

  // Handle initial load and new messages
  useEffect(() => {
    const isNewMessage = messages.length > previousMessagesLength.current
    previousMessagesLength.current = messages.length

    if (messages.length > 0) {
      if (isInitialLoad.current) {
        // For initial load, scroll immediately with 'auto'
        scrollToBottom('auto')
        isInitialLoad.current = false
      } else if (shouldAutoScroll && isNewMessage) {
        // For new messages, use smooth scrolling
        scrollToBottom('smooth')
      }
    }
  }, [messages, shouldAutoScroll])

  // Reset scroll behavior when changing channels
  useEffect(() => {
    setShouldAutoScroll(true)
    previousMessagesLength.current = 0
    isInitialLoad.current = true // Reset initial load flag when changing channels
    scrollToBottom('auto')
  }, [messages.length === 0])

  useEffect(() => {
    async function getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    getCurrentUser()
  }, [supabase])

  // Add a new useEffect to fetch reply counts
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

      // Count replies for each message
      const counts = data.reduce((acc: Record<string, number>, reply) => {
        acc[reply.message_id] = (acc[reply.message_id] || 0) + 1;
        return acc;
      }, {});

      setReplyCounts(counts);
    };

    fetchReplyCounts();
  }, [messages, showThreads, supabase]);

  // Add this useEffect after the reply counts useEffect
  useEffect(() => {
    if (!showThreads) return;

    // Subscribe to reply changes
    const channel = supabase
      .channel('message_replies_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_replies'
        },
        () => {
          // Refetch counts when replies change
          const fetchReplyCounts = async () => {
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showThreads, messages, supabase]);

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

  // Separate useEffect for intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { 
        root: containerRef.current,
        threshold: 0,
        rootMargin: '200px 0px'
      }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.disconnect()
      }
    }
  }, [hasMore, loading, loadMore])

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-6 bg-white messages-container"
    >
      {/* Observer target for infinite scroll - moved to top */}
      <div 
        ref={observerTarget}
        className="h-8 -mt-4"
        style={{ visibility: hasMore ? 'visible' : 'hidden' }}
      />

      {/* Loading indicator */}
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
                  onImageLoad={() => {
                    if (isNearBottom) {
                      scrollToBottom()
                    }
                  }}
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
      <div ref={messagesEndRef} />
    </div>
  )
} 