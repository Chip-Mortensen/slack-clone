import { useState, useEffect } from 'react'
import { useSupabase } from '../supabase-provider'
import type { Channel } from '@/app/types'

export function useChannels() {
  const { supabase } = useSupabase()
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null)

  // Initial fetch of channels
  useEffect(() => {
    async function fetchChannels() {
      try {
        const { data: channelsData, error } = await supabase
          .from('channels')
          .select('*')
          .order('created_at', { ascending: true })

        if (error) throw error
        setChannels(channelsData)
        
        // Set initial channel
        if (channelsData.length > 0) {
          setCurrentChannel(channelsData[0])
        }
      } catch (error) {
        console.error('Error fetching channels:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchChannels()

    // Real-time subscription for channels
    const channel = supabase
      .channel('public:channels')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels'
        },
        async (payload) => {
          console.log('Channel change received:', payload)

          if (payload.eventType === 'INSERT') {
            setChannels(prev => {
              if (prev.some(ch => ch.id === payload.new.id)) {
                return prev
              }
              return [...prev, payload.new as Channel]
            })
          }
          
          if (payload.eventType === 'DELETE') {
            setChannels(prev => prev.filter(ch => ch.id !== payload.old.id))
            if (currentChannel?.id === payload.old.id) {
              const firstChannel = channels.find(ch => ch.id !== payload.old.id)
              setCurrentChannel(firstChannel || null)
            }
          }

          if (payload.eventType === 'UPDATE') {
            setChannels(prev => 
              prev.map(ch => 
                ch.id === payload.new.id ? { ...ch, ...payload.new } : ch
              )
            )
            if (currentChannel?.id === payload.new.id) {
              setCurrentChannel(prev => prev ? { ...prev, ...payload.new } : null)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const createChannel = async (channelName: string, userId: string) => {
    try {
      const { data: newChannel, error } = await supabase
        .from('channels')
        .insert({ 
          name: channelName.toLowerCase().trim(),
          created_by: userId
        })
        .select('*')
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('A channel with this name already exists')
        }
        throw new Error(error.message || 'Failed to create channel')
      }

      if (!newChannel) {
        throw new Error('Failed to create channel')
      }

      setChannels(prev => [...prev, newChannel])
      setCurrentChannel(newChannel)
      return newChannel
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