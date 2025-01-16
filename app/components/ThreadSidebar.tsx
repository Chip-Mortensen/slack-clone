'use client'

import { useEffect, useState, useRef } from 'react'
import { useSupabase } from '../supabase-provider'
import { X } from 'lucide-react'
import type { Message, MessageReply } from '@/app/types/models'
import MessageInput from './MessageInput'
import MessageContent from './MessageContent'
import UserAvatar from './UserAvatar'
import MessageReactions from './MessageReactions'
import { useName } from '../contexts/NameContext'

interface ThreadSidebarProps {
  parentMessage: Message | null
  onClose: () => void
}

export default function ThreadSidebar({ parentMessage, onClose }: ThreadSidebarProps) {
  const { supabase } = useSupabase()
  const { getUsername, loadUsername } = useName()
  const [replies, setReplies] = useState<MessageReply[]>([])
  const [newReply, setNewReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [atBottom, setAtBottom] = useState(true)
  const repliesEndRef = useRef<HTMLDivElement>(null)
  const repliesContainerRef = useRef<HTMLDivElement>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (repliesContainerRef.current) {
      repliesContainerRef.current.scrollTop = repliesContainerRef.current.scrollHeight
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    const buffer = 100 // pixels from bottom to consider "at bottom"
    setAtBottom(scrollHeight - scrollTop - clientHeight < buffer)
  }

  // Scroll to bottom on initial load and new messages if user was at bottom
  useEffect(() => {
    if (atBottom) {
      scrollToBottom('auto')
    }
  }, [replies])

  // Initial scroll
  useEffect(() => {
    // Use 'auto' for initial load
    scrollToBottom('auto')
  }, [])

  // Add an effect to handle image loading
  useEffect(() => {
    const images = repliesContainerRef.current?.getElementsByTagName('img')
    if (!images) return

    const imageLoadPromises = Array.from(images).map(img => {
      if (img.complete) return Promise.resolve()
      return new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true })
      })
    })

    Promise.all(imageLoadPromises).then(() => {
      if (atBottom) {
        scrollToBottom()
      }
    })
  }, [replies])

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

  useEffect(() => {
    if (!parentMessage) return

    const fetchReplies = async () => {
      try {
        const { data, error } = await supabase
          .from('message_replies')
          .select(`
            *,
            profiles!message_replies_user_id_fkey (
              id,
              username,
              avatar_url
            ),
            reactions:message_reactions!message_reactions_reply_id_fkey (
              id,
              emoji,
              user_id,
              created_at
            )
          `)
          .eq('message_id', parentMessage.id)
          .order('created_at', { ascending: true })

        if (error) throw error
        setReplies(data || [])
      } catch (error) {
        console.error('Error fetching replies:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReplies()

    // Create a channel for both replies and their reactions
    const repliesChannel = supabase
      .channel(`message_replies:${parentMessage.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_replies',
          filter: `message_id=eq.${parentMessage.id}`
        },
        async (payload) => {
          const { data, error } = await supabase
            .from('message_replies')
            .select(`
              *,
              profiles!message_replies_user_id_fkey (
                id,
                username,
                avatar_url
              ),
              reactions:message_reactions!message_reactions_reply_id_fkey (
                id,
                emoji,
                user_id,
                created_at
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (!error && data) {
            setReplies(prev => [...prev, data])
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `reply_id=in.(${replies.map(reply => `'${reply.id}'`).join(',')})`
        },
        () => {
          // Refetch replies when reactions change
          fetchReplies()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(repliesChannel)
    }
  }, [parentMessage, supabase, replies])

  // Add this function to extract mentions
  const extractMentions = (content: string) => {
    const mentionRegex = /@\[([^\]]+)\]/g;
    const matches = content.match(mentionRegex);
    if (!matches) return [];
    return matches.map(match => match.slice(2, -1)); // Remove @[ and ]
  };

  const handleSendReply = async (e: React.FormEvent, fileInfo?: { url: string, name: string }) => {
    e.preventDefault();
    if (!parentMessage || (!newReply.trim() && !fileInfo)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      
      // First, send the original reply
      const { data: reply, error } = await supabase
        .from('message_replies')
        .insert({
          message_id: parentMessage.id,
          content: newReply,
          user_id: user.id,
          file_url: fileInfo?.url,
          file_name: fileInfo?.name
        })
        .select()
        .single();

      if (error) throw error;

      // Extract mentions from the reply
      const mentionedUsernames = extractMentions(newReply);
      
      if (mentionedUsernames.length > 0) {
        // Get profiles of mentioned users who have auto-respond enabled
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, auto_respond')
          .in('username', mentionedUsernames)
          .eq('auto_respond', true);

        if (profileError) {
          console.error('Error fetching profiles:', profileError);
          return;
        }

        // Generate AI responses for each user with auto-respond enabled
        const responsePromises = profiles?.map(async (profile) => {
          try {
            const response = await fetch('/api/reply-chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messageId: parentMessage.id,
                replyId: reply.id,
                content: newReply,
                senderId: user.id,
                responderId: profile.id
              })
            });

            if (!response.ok) {
              throw new Error(`Failed to generate AI response for ${profile.username}`);
            }

            return await response.json();
          } catch (error) {
            console.error(`Error generating AI response for ${profile.username}:`, error);
            return null;
          }
        }) || [];

        // Wait for all AI responses to complete
        await Promise.allSettled(responsePromises);
      }

      setNewReply('');
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  };

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    getCurrentUser()
  }, [supabase])

  const handleAddReaction = async (replyId: number, emoji: string) => {
    if (!currentUserId) return

    try {
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          reply_id: replyId,
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

  // Load usernames for all participants
  useEffect(() => {
    if (parentMessage) {
      loadUsername(parentMessage.user_id.toString())
    }
    replies.forEach(reply => {
      loadUsername(reply.user_id.toString())
    })
  }, [parentMessage, replies, loadUsername])

  if (!parentMessage) return null

  return (
    <div className="w-96 border-l border-gray-200 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        <div>
          <h3 className="font-bold">Thread</h3>
          <span className="text-sm text-gray-500">{replies.length} replies</span>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <X size={20} />
        </button>
      </div>

      {/* Parent Message */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start space-x-3">
          <UserAvatar
            userId={parentMessage.user_id}
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold">
                {getUsername(parentMessage.user_id.toString()) || 'Unknown User'}
              </span>
              <span className="text-sm text-gray-500">
                {formatTimestamp(new Date(parentMessage.created_at))}
              </span>
            </div>
            <MessageContent 
              content={parentMessage.content}
              fileUrl={parentMessage.file_url}
              fileName={parentMessage.file_name}
            />
          </div>
        </div>
      </div>

      {/* Replies */}
      <div 
        ref={repliesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {replies.map((reply) => (
          <div 
            key={reply.id} 
            className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors duration-150"
          >
            <UserAvatar
              userId={reply.user_id}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-bold">
                  {getUsername(reply.user_id.toString()) || 'Unknown User'}
                </span>
                <span className="text-sm text-gray-500">
                  {formatTimestamp(new Date(reply.created_at))}
                </span>
              </div>
              <MessageContent 
                content={reply.content}
                fileUrl={reply.file_url}
                fileName={reply.file_name}
                onImageLoad={() => {
                  if (atBottom) {
                    scrollToBottom()
                  }
                }}
              />
              {currentUserId && (
                <MessageReactions
                  messageId={reply.id}
                  isReply={true}
                  reactions={reply.reactions || []}
                  currentUserId={currentUserId}
                  onAddReaction={(emoji) => handleAddReaction(reply.id, emoji)}
                  onRemoveReaction={handleRemoveReaction}
                />
              )}
            </div>
          </div>
        ))}
        <div ref={repliesEndRef} />
      </div>

      {/* Reply Input */}
      <div className="bg-gray-100 border-gray-200">
        <MessageInput
          value={newReply}
          onChange={setNewReply}
          onSubmit={handleSendReply}
          placeholder="Reply in thread..."
        />
      </div>
    </div>
  )
} 