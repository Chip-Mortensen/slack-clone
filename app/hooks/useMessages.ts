import { useState, useEffect } from 'react'
import { useSupabase } from '../supabase-provider'
import type { Message } from '@/app/types'

export function useMessages(channelId: string | null) {
  const { supabase } = useSupabase()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 20

  // Function to fetch messages
  const fetchMessages = async (lastTimestamp?: string) => {
    if (!channelId) return

    try {
      let query = supabase
        .from('messages')
        .select(`
          *,
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
      console.error('Error fetching messages:', error)
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
  }, [channelId])

  // Set up real-time subscription for new messages and reactions
  useEffect(() => {
    if (!channelId) return

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
        async (payload) => {
          // Fetch the complete message data including profile and reactions
          const { data, error } = await supabase
            .from('messages')
            .select(`
              *,
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
            .from('messages')
            .select(`
              *,
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
  }, [channelId, supabase])

  const sendMessage = async (
    content: string, 
    userId: string,
    fileUrl?: string,
    fileName?: string
  ) => {
    if (!channelId) return

    const { error } = await supabase
      .from('messages')
      .insert({
        content,
        user_id: userId,
        channel_id: channelId,
        file_url: fileUrl,
        file_name: fileName
      })

    if (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }

  return {
    messages,
    loading,
    hasMore,
    loadMore: () => {
      console.log('loadMore called with:', {
        messagesCount: messages.length,
        oldestMessage: messages[0]
      })
      if (messages.length > 0) {
        const oldestMessage = messages[0]
        fetchMessages(oldestMessage.created_at)
      }
    },
    sendMessage
  }
} 