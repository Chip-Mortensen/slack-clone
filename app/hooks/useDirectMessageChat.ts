import { useState, useEffect, useRef } from 'react'
import { useSupabase } from '../supabase-provider'
import type { DirectMessage, Conversation } from '@/app/types'

export function useDirectMessageChat(conversation: Conversation | null) {
  const { supabase } = useSupabase()
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 20
  const initialLoadPromiseRef = useRef<Promise<void> | null>(null)

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
          ),
          voice_url
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
          console.log('=== Realtime Event Received ===')
          console.log('Payload:', payload)
          console.log('Current messages:', messages)

          // Check if we already have this message locally
          if (messages.some(m => 
            m.sender_id === payload.new.sender_id && 
            m.message === payload.new.message && 
            Math.abs(new Date(m.created_at).getTime() - new Date(payload.new.created_at).getTime()) < 1000
          )) {
            console.log('Duplicate message detected, skipping')
            return;
          }

          console.log('Fetching full message details')
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
              ),
              voice_url
            `)
            .eq('id', payload.new.id)
            .single()

          console.log('Full message fetch result:', { data, error })

          if (!error && data) {
            console.log('Adding message to state')
            setMessages(prev => [...prev, data])
            // Force scroll to bottom for new messages
            setTimeout(() => {
              const container = document.querySelector('.messages-container')
              if (container) {
                container.scrollTop = container.scrollHeight
              }
            }, 0)
          }
          console.log('=== End Realtime Event ===')
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        async (payload) => {
          // Update the message with new voice_url
          setMessages(prev => prev.map(msg => 
            msg.id === payload.new.id 
              ? { ...msg, voice_url: payload.new.voice_url }
              : msg
          ))
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
              ),
              voice_url
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
      console.log('=== START sendMessage ===')
      console.log('Params:', { message, userId, fileUrl, fileName })
      if (!conversation) return

      // Determine receiver_id based on the conversation
      const receiverId = conversation.user1_id === userId 
        ? conversation.user2_id 
        : conversation.user1_id
      console.log('Determined receiverId:', receiverId)

      console.log('Attempting to insert message into Supabase')
      const { error, data } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: userId,
          receiver_id: receiverId,
          message: message,
          file_url: fileUrl,
          file_name: fileName
        })
        .select()
        .single()

      console.log('Insert response:', { error, data })

      if (error) {
        console.error('Error in sendMessage:', error)
        throw error
      }

      // Trigger voice generation
      /* Commented out to prevent API usage
      fetch('/api/generate-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message,
          messageId: data.id,
          messageType: 'direct_message'
        })
      }).catch(error => {
        console.error('Voice generation error:', error)
        // Don't throw - we want voice generation to be non-blocking
      })
      */

      console.log('=== END sendMessage ===')
    },
    initialLoadPromise: initialLoadPromiseRef.current
  }
} 