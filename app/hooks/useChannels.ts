import { useState, useEffect } from 'react'
import { useSupabase } from '../supabase-provider'
import type { Channel } from '@/app/types'

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
          .select('*')
          .order('created_at', { ascending: true })

        if (error) throw error
        setChannels(data || [])
        
        // Set first channel as default if no channel is selected
        if (data && data.length > 0 && !currentChannel) {
          setCurrentChannel(data[0])
        }
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
  }, [supabase, currentChannel])

  const createChannel = async (name: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .insert({
          name,
          created_by: userId
        })
        .select()
        .single()

      if (error) throw error
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