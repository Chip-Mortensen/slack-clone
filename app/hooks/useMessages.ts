import { useState, useEffect } from 'react'
import { useSupabase } from '../supabase-provider'
import type { Message } from '@/app/types'

export function useMessages(channelId: string | null) {
  const { supabase } = useSupabase()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const messageIds = messages.map(m => m.id).join(',')  // Memoize message IDs

  useEffect(() => {
    if (!channelId) {
      setMessages([])
      setLoading(false)
      return
    }

    async function fetchMessages() {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            user_id,
            channel_id,
            profiles (
              id,
              username,
              avatar_url
            ),
            reactions:message_reactions (
              id,
              emoji,
              user_id,
              created_at
            )
          `)
          .eq('channel_id', channelId)
          .order('created_at', { ascending: true })

        if (error) throw error
        setMessages(data || [])
      } catch (error) {
        console.error('Error fetching messages:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()

    // Subscribe to new messages and reactions
    const messagesChannel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          const newMessage = payload.new as Message
          setMessages(prev => [...prev, newMessage])
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions'
        },
        async (payload) => {
          console.log('Reaction change detected:', {
            event: payload.eventType,
            new: payload.new,
            old: payload.old
          })
          
          // Always refetch messages on any reaction change
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
    }
  }, [channelId, supabase, messageIds]) // Use messageIds instead of messages

  const sendMessage = async (content: string, userId: string) => {
    if (!channelId) return

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          content,
          channel_id: channelId,
          user_id: userId
        })

      if (error) throw error
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }

  return {
    messages,
    loading,
    sendMessage
  }
} 