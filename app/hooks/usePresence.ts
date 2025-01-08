'use client'

import { useEffect } from 'react'
import { useSupabase } from '../supabase-provider'
import { RealtimeChannel } from '@supabase/supabase-js'

export function usePresence() {
  const { supabase } = useSupabase()

  useEffect(() => {
    let presenceChannel: RealtimeChannel

    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // First create and subscribe to the channel
      presenceChannel = supabase.channel('online-users')
        .on('presence', { event: 'sync' }, () => {
          // Handle presence sync
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          if (key === user.id) {
            updatePresence(user.id, true)
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          if (key === user.id) {
            updatePresence(user.id, false)
          }
        })

      // Subscribe first
      await presenceChannel.subscribe()

      // Then track presence
      await presenceChannel.track({
        user_id: user.id,
        online_at: new Date().toISOString()
      })

      // Update initial presence
      await updatePresence(user.id, true)
    }

    const updatePresence = async (userId: string, isOnline: boolean) => {
      try {
        const { error } = await supabase
          .from('user_presence')
          .upsert(
            {
              id: userId,
              user_id: userId,
              is_online: isOnline,
              last_seen: new Date().toISOString()
            },
            {
              onConflict: 'user_id',
              ignoreDuplicates: false
            }
          )

        if (error) throw error
      } catch (error) {
        console.error('Error updating presence:', error)
      }
    }

    setupPresence()

    return () => {
      if (presenceChannel) {
        const userId = presenceChannel.presenceState()?.[0]?.user_id
        if (userId) {
          updatePresence(userId, false).then(() => {
            presenceChannel.unsubscribe()
          })
        }
      }
    }
  }, [supabase])
} 