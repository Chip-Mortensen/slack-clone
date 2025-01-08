'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '../supabase-provider'
import { X } from 'lucide-react'
import type { Message, MessageReply } from '@/app/types'
import MessageInput from './MessageInput'
import MessageContent from './MessageContent'
import UserAvatar from './UserAvatar'

interface ThreadSidebarProps {
  parentMessage: Message | null
  onClose: () => void
}

export default function ThreadSidebar({ parentMessage, onClose }: ThreadSidebarProps) {
  const { supabase } = useSupabase()
  const [replies, setReplies] = useState<MessageReply[]>([])
  const [newReply, setNewReply] = useState('')
  const [loading, setLoading] = useState(true)

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
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (!error && data) {
            setReplies(prev => [...prev, data])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(repliesChannel)
    }
  }, [parentMessage, supabase])

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parentMessage || !newReply.trim()) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')
      
      const { data, error } = await supabase
        .from('message_replies')
        .insert({
          message_id: parentMessage.id,
          content: newReply,
          user_id: user.id
        })
        .select()

      if (error) throw error
      setNewReply('')
    } catch (error) {
      console.error('Error sending reply:', error)
    }
  }

  if (!parentMessage) return null

  return (
    <div className="w-96 border-l border-gray-200 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        <div>
          <h3 className="font-medium">Thread</h3>
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
            avatarUrl={parentMessage.profiles.avatar_url}
            username={parentMessage.profiles.username}
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">{parentMessage.profiles.username}</span>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {replies.map((reply) => (
          <div key={reply.id} className="flex items-start space-x-3">
            <UserAvatar
              userId={reply.user_id}
              avatarUrl={reply.profiles.avatar_url}
              username={reply.profiles.username}
            />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium">{reply.profiles.username}</span>
                <span className="text-sm text-gray-500">
                  {formatTimestamp(new Date(reply.created_at))}
                </span>
              </div>
              <MessageContent 
                content={reply.content}
                fileUrl={reply.file_url}
                fileName={reply.file_name}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Reply Input */}
      <div className="p-4 border-t border-gray-200">
        <MessageInput
          value={newReply}
          onChange={setNewReply}
          onSubmit={handleSendReply}
          placeholder="Reply in thread..."
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              const form = e.currentTarget.form
              if (form) {
                // Find and click the submit button
                const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement
                if (submitButton && !submitButton.disabled) {
                  submitButton.click()
                }
              }
            }
          }}
        />
      </div>
    </div>
  )
} 