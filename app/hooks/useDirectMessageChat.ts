import { useState, useEffect } from 'react'
import { useSupabase } from '../supabase-provider'
import type { DirectMessage, Conversation } from '@/app/types'

export function useDirectMessageChat(conversation: Conversation | null) {
  const { supabase } = useSupabase()
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const messageIds = messages.map(m => m.id).join(',')  // Memoize message IDs

  useEffect(() => {
    if (!conversation) {
      setMessages([])
      setLoading(false)
      return
    }

    async function fetchMessages() {
      try {
        const { data, error } = await supabase
          .from('direct_messages')
          .select(`
            id,
            message,
            created_at,
            sender_id,
            receiver_id,
            conversation_id,
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
          .order('created_at', { ascending: true })

        if (error) throw error
        setMessages(data || [])
      } catch (error) {
        console.error('Error fetching direct messages:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()

    // Subscribe to new messages and reactions
    const channel = supabase
      .channel(`direct_messages:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          const newMessage = payload.new as DirectMessage
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
          console.log('DM Reaction change detected:', {
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
      supabase.removeChannel(channel)
    }
  }, [conversation, supabase, messageIds]) // Use messageIds instead of messages

  const sendMessage = async (content: string, userId: string) => {
    if (!conversation) return

    // Create optimistic message
    const optimisticMessage: DirectMessage = {
      id: -Date.now(), // Temporary negative ID
      message: content,
      created_at: new Date().toISOString(),
      sender_id: userId,
      receiver_id: conversation.other_user.id,
      conversation_id: conversation.id,
      sender: {
        id: userId,
        username: 'Sending...', // Will be updated with real data
        avatar_url: null
      }
    }

    // Add optimistic message
    setMessages(prev => [...prev, optimisticMessage])

    try {
      const { error, data } = await supabase
        .from('direct_messages')
        .insert({
          message: content,
          sender_id: userId,
          receiver_id: conversation.other_user.id,
          conversation_id: conversation.id
        })
        .select(`
          *,
          sender:profiles!direct_messages_sender_id_fkey (
            id,
            username,
            avatar_url
          )
        `)
        .single()

      if (error) {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
        throw error
      }

      if (data) {
        // Replace optimistic message with real one
        setMessages(prev => 
          prev.map(msg => 
            msg.id === optimisticMessage.id ? data : msg
          )
        )
      }
    } catch (error) {
      console.error('Error sending direct message:', error)
      throw error
    }
  }

  return {
    messages,
    loading,
    sendMessage
  }
} 