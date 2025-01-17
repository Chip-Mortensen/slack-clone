import { useState, useEffect } from 'react'
import { useSupabase } from '../supabase-provider'
import type { Channel } from '@/app/types/models'
import { profileCache } from '../utils/profileCache'

export function useChannels() {
  const { supabase } = useSupabase()
  const [channels, setChannels] = useState<Channel[]>([])
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchChannels() {
      try {
        const { data, error } = await supabase
          .from('channels')
          .select(`
            *,
            creator:profiles!channels_created_by_fkey (
              id, username, avatar_url
            )
          `)
          .order('created_at', { ascending: true })

        if (error) throw error

        // Cache creator avatar URLs
        data?.forEach(channel => {
          if (channel.creator?.avatar_url) {
            profileCache.set(`avatar_${channel.creator.id}`, channel.creator.avatar_url)
          }
        })

        setChannels(data || [])
      } catch (error) {
        console.error('Error fetching channels:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchChannels()

    // Subscribe to channel changes
    const channelsChannel = supabase
      .channel('channels')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels'
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            // Handle channel deletion
            setChannels(prev => prev.filter(channel => channel.id !== payload.old.id))
            // If the deleted channel is currently selected, clear it
            if (currentChannel?.id === payload.old.id) {
              setCurrentChannel(null)
            }
          } else if (payload.eventType === 'INSERT') {
            // Handle new channel
            const newChannel = payload.new as Channel
            setChannels(prev => [...prev, newChannel])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelsChannel)
    }
  }, [supabase])

  const createChannel = async (name: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .insert({
          name,
          created_by: userId
        })
        .select(`
          *,
          creator:profiles!channels_created_by_fkey (
            id, username, avatar_url
          )
        `)
        .single()

      if (error) throw error

      // Cache creator avatar URL
      if (data?.creator?.avatar_url) {
        profileCache.set(`avatar_${data.creator.id}`, data.creator.avatar_url)
      }

      return data
    } catch (error) {
      console.error('Error creating channel:', error)
      throw error
    }
  }

  return {
    channels,
    currentChannel,
    setCurrentChannel,
    loading,
    createChannel
  }
} 