import { useState, useEffect } from 'react'
import { useSupabase } from '../supabase-provider'
import type { Conversation } from '@/app/types/models'
import { profileCache } from '../utils/profileCache'

export function useDirectMessages() {
  const { supabase } = useSupabase()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchConversations() {
      try {
        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user) return

        const { data, error } = await supabase
          .from('conversations')
          .select(`
            *,
            user1:profiles!conversations_user1_id_fkey (
              id, username, avatar_url
            ),
            user2:profiles!conversations_user2_id_fkey (
              id, username, avatar_url
            )
          `)
          .or(`user1_id.eq.${userData.user.id},user2_id.eq.${userData.user.id}`)
          .order('updated_at', { ascending: false })

        if (error) throw error

        // Transform the data to include the correct other_user
        const transformedData = data.map(conv => ({
          ...conv,
          other_user: conv.user1_id === userData.user.id ? conv.user2 : conv.user1
        }))

        // Cache avatar URLs for both users in each conversation
        data.forEach(conv => {
          if (conv.user1?.avatar_url) {
            profileCache.set(`avatar_${conv.user1.id}`, conv.user1.avatar_url)
          }
          if (conv.user2?.avatar_url) {
            profileCache.set(`avatar_${conv.user2.id}`, conv.user2.avatar_url)
          }
        })

        setConversations(transformedData)
      } catch (error) {
        console.error('Error fetching conversations:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchConversations()

    // Subscribe to new conversations and deletions
    const channel = supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        (payload) => {
          console.log('Conversation change received:', payload)
          if (payload.eventType === 'DELETE') {
            setConversations(prev => 
              prev.filter(conv => conv.id !== payload.old.id)
            )
            // Also clear currentConversation if it was deleted
            setCurrentConversation(prev => 
              prev?.id === payload.old.id ? null : prev
            )
          } else {
            fetchConversations()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const startConversation = async (otherUserId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      // Ensure consistent ordering of user IDs
      const [user1_id, user2_id] = [userData.user.id, otherUserId].sort()

      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user1_id,
          user2_id
        })
        .select(`
          *,
          other_user:profiles!conversations_user2_id_fkey (
            id,
            username,
            avatar_url
          )
        `)
        .single()

      if (error) {
        if (error.code === '23505') { // Unique violation
          // Conversation already exists, fetch it
          const { data: existingConv, error: fetchError } = await supabase
            .from('conversations')
            .select(`
              *,
              other_user:profiles!conversations_user2_id_fkey (
                id,
                username,
                avatar_url
              )
            `)
            .or(`and(user1_id.eq.${user1_id},user2_id.eq.${user2_id}),
                 and(user1_id.eq.${user2_id},user2_id.eq.${user1_id})`)
            .single()

          if (fetchError) throw fetchError

          // Cache the avatar URL from the existing conversation
          if (existingConv?.other_user?.avatar_url) {
            profileCache.set(`avatar_${existingConv.other_user.id}`, existingConv.other_user.avatar_url)
          }

          return existingConv
        }
        throw error
      }

      // Cache the avatar URL from the new conversation
      if (data?.other_user?.avatar_url) {
        profileCache.set(`avatar_${data.other_user.id}`, data.other_user.avatar_url)
      }

      return data
    } catch (error) {
      console.error('Error starting conversation:', error)
      throw error
    }
  }

  return {
    conversations,
    currentConversation,
    setCurrentConversation,
    setConversations,
    loading,
    startConversation
  }
} 