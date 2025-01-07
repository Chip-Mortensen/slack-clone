import { useState, useEffect } from 'react'
import { useSupabase } from '../supabase-provider'
import type { DirectMessage, Conversation } from '@/app/types'

export function useDirectMessageChat(conversation: Conversation | null) {
  const { supabase } = useSupabase()
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 20

  // Function to fetch messages
  const fetchMessages = async (lastTimestamp?: string) => {
    if (!conversation) return

    try {
      let query = supabase
        .from('direct_messages')
        .select(`
          *,
          sender:profiles!direct_messages_sender_id_fkey (
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
        .eq('conversation_id', conversation.id)

      if (lastTimestamp) {
        // For pagination, get older messages in ascending order
        query = query
          .lt('created_at', lastTimestamp)
          .order('created_at', { ascending: true })
          .limit(PAGE_SIZE)
      } else {
        // For initial load, get newest messages in descending order
        query = query
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE)
      }

      const { data, error } = await query

      if (error) throw error

      const newMessages = data || []
      setHasMore(newMessages.length === PAGE_SIZE)
      
      if (lastTimestamp) {
        // For pagination, add older messages to the beginning
        setMessages(prev => [...newMessages, ...prev])
      } else {
        // For initial load, show newest messages at bottom
        setMessages(newMessages.reverse())
      }
    } catch (error) {
      console.error('Error fetching direct messages:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    setLoading(true)
    setMessages([])
    setHasMore(true)
    fetchMessages()
  }, [conversation])

  // Set up real-time subscription
  useEffect(() => {
    if (!conversation) return

    const messagesChannel = supabase
      .channel(`direct_messages:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        async (payload) => {
          const { data, error } = await supabase
            .from('direct_messages')
            .select(`
              *,
              sender:profiles!direct_messages_sender_id_fkey (
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
            .eq('id', payload.new.id)
            .single()

          if (!error && data) {
            setMessages(prev => [...prev, data])
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions'
        },
        async () => {
          // Refetch all messages to get updated reactions
          const { data, error } = await supabase
            .from('direct_messages')
            .select(`
              *,
              sender:profiles!direct_messages_sender_id_fkey (
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
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE)

          if (!error && data) {
            setMessages(data.reverse())
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
    }
  }, [conversation, supabase])

  return {
    messages,
    loading,
    hasMore,
    loadMore: () => {
      if (messages.length > 0) {
        const oldestMessage = messages[0]
        fetchMessages(oldestMessage.created_at)
      }
    },
    sendMessage: async (message: string, userId: string, fileUrl?: string, fileName?: string) => {
      if (!conversation) return

      const { error } = await supabase
        .from('direct_messages')
        .insert({
          message,
          sender_id: userId,
          conversation_id: conversation.id,
          file_url: fileUrl,
          file_name: fileName
        })

      if (error) {
        console.error('Error sending direct message:', error)
        throw error
      }
    }
  }
} 