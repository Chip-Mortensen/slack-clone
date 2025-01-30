import { useState, useEffect, useRef, useCallback } from 'react'
import { useSupabase } from '../supabase-provider'
import type { Message } from '@/app/types'

// Helper to extract mentions from message content
const extractMentions = (content: string): string[] => {
  const mentionRegex = /@\[([^\]]+)\]/g
  const mentions: string[] = []
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1])
  }

  return mentions
}

export function useMessages(channelId: string | number | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const loadingRef = useRef(false)
  const PAGE_SIZE = 20

  // Create a ref to store the current channelId
  const currentChannelRef = useRef<string | number | null>(null)
  
  // Create a promise ref for the initial load
  const initialLoadPromiseRef = useRef<Promise<void> | null>(null)

  const { supabase } = useSupabase()

  const fetchMessages = useCallback(async (lastTimestamp?: string) => {
    if (!channelId || loadingRef.current) return null

    loadingRef.current = true
    setLoading(true)

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
          ),
          voice_url
        `)
        .eq('channel_id', channelId)

      if (lastTimestamp) {
        query = query
          .lt('created_at', lastTimestamp)
          .order('created_at', { ascending: true })
          .limit(PAGE_SIZE)
      } else {
        query = query
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE)
      }

      const { data, error } = await query
      if (error) throw error

      // Only update state if we're still on the same channel
      if (channelId === currentChannelRef.current) {
        const newMessages = data || []
        setHasMore(newMessages.length === PAGE_SIZE)
        
        if (lastTimestamp) {
          setMessages(prev => [...newMessages, ...prev])
        } else {
          setMessages(newMessages.reverse())
        }
      }

      return data
    } catch (error) {
      console.error('Error fetching messages:', error)
      return null
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [channelId, supabase])

  // Handle channel changes
  useEffect(() => {
    currentChannelRef.current = channelId
    setMessages([])
    setHasMore(true)
    
    if (channelId) {
      // Create a new promise for the initial load
      initialLoadPromiseRef.current = fetchMessages().then(() => {})
    } else {
      initialLoadPromiseRef.current = null
    }

    return () => {
      // Clear the promise when unmounting or changing channels
      initialLoadPromiseRef.current = null
    }
  }, [channelId, fetchMessages])

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
              ),
              voice_url
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
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`
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
              ),
              voice_url
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

    try {
      // First, send the original message
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          content,
          user_id: userId,
          channel_id: channelId,
          file_url: fileUrl,
          file_name: fileName
        })
        .select()
        .single()

      if (messageError) throw messageError

      // Trigger voice generation
      /* Commented out to prevent API usage
      fetch('/api/generate-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          messageId: message.id,
          messageType: 'message'
        })
      }).catch(error => {
        console.error('Voice generation error:', error)
        // Don't throw - we want voice generation to be non-blocking
      })
      */

      // Extract mentions from the message
      const mentionedUsernames = extractMentions(content)
      console.log('Extracted mentions:', mentionedUsernames)
      
      if (mentionedUsernames.length > 0) {
        // Get profiles of mentioned users who have auto-respond enabled
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, auto_respond')
          .in('username', mentionedUsernames)
          .eq('auto_respond', true)

        if (profileError) {
          console.error('Error fetching profiles:', profileError)
          return
        }

        console.log('Found profiles with auto-respond:', profiles)

        // Generate AI responses for each user with auto-respond enabled
        const responsePromises = profiles?.map(async (profile) => {
          console.log('Generating response for:', profile.username)
          try {
            const response = await fetch('/api/channel-chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messageId: message.id,
                channelId,
                content,
                senderId: userId,
                responderId: profile.id
              })
            })

            if (!response.ok) {
              throw new Error(`Failed to generate AI response for ${profile.username}`)
            }

            const result = await response.json()
            console.log('AI response result:', result)
            return result
          } catch (error) {
            console.error(`Error generating AI response for ${profile.username}:`, error)
            return null
          }
        }) || []

        // Wait for all AI responses to complete
        const results = await Promise.allSettled(responsePromises)
        console.log('AI response results:', results)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }

  const loadMore = useCallback(async () => {
    if (messages.length > 0 && !loadingRef.current) {
      const oldestMessage = messages[0]
      return fetchMessages(oldestMessage.created_at)
    }
    return null
  }, [messages, fetchMessages])

  return {
    messages,
    loading,
    hasMore,
    loadMore,
    initialLoadPromise: initialLoadPromiseRef.current,
    sendMessage
  }
} 