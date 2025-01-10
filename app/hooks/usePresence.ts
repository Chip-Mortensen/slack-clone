'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '../supabase-provider'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UserPresence {
  user_id: string
  is_online: boolean
  last_seen: string
  updated_at: string
}

const CLEANUP_THRESHOLD = 10 * 1000 // 10 seconds for updated_at
const LAST_SEEN_THRESHOLD = 30 * 1000 // 30 seconds for last_seen fallback

const isUserActive = (presence: UserPresence) => {
  try {
    if (!presence.updated_at || !presence.last_seen) {
      return false
    }

    const lastUpdate = new Date(presence.updated_at).getTime()
    const lastSeen = new Date(presence.last_seen).getTime()
    const now = Date.now()
    
    if (isNaN(lastUpdate) || isNaN(lastSeen)) {
      return false
    }
    
    const isStale = now - lastUpdate > CLEANUP_THRESHOLD
    const isInactive = now - lastSeen > LAST_SEEN_THRESHOLD

    return presence.is_online && !isStale && !isInactive
  } catch (error) {
    console.error('Error checking user active status:', error)
    return false
  }
}

export const usePresence = () => {
  const { supabase } = useSupabase()
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  
  useEffect(() => {
    let presenceChannel: RealtimeChannel
    let heartbeatInterval: NodeJS.Timeout
    let stalePollInterval: NodeJS.Timeout

    const checkStaleUsers = async () => {
      const { data: presenceData } = await supabase
        .from('user_presence')
        .select('user_id, is_online, updated_at, last_seen')

      const activeUsers = (presenceData || [])
        .filter(isUserActive)
        .map(p => p.user_id)

      setOnlineUsers(activeUsers)
    }

    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Initial fetch of all online users
      const { data: presenceData } = await supabase
        .from('user_presence')
        .select('user_id, is_online, updated_at, last_seen')

      // Filter active users based on timestamp and online status
      const activeUsers = (presenceData || [])
        .filter(isUserActive)
        .map(p => p.user_id)

      setOnlineUsers(activeUsers)

      // Subscribe to presence changes
      presenceChannel = supabase
        .channel('presence-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_presence'
          },
          (payload) => {
            if (payload.new) {
              const presence = payload.new as UserPresence
              setOnlineUsers(prev => {
                const next = isUserActive(presence)
                  ? Array.from(new Set([...prev, presence.user_id]))
                  : prev.filter(id => id !== presence.user_id)
                return next
              })
            }
          }
        )
        .subscribe()

      // Update own presence
      await updatePresence(user.id, true)

      // Setup heartbeat
      heartbeatInterval = setInterval(() => {
        void updatePresence(user.id, true)
      }, 5000)

      // Add polling for stale users every 10 seconds
      stalePollInterval = setInterval(() => {
        void checkStaleUsers()
      }, 10000) // Check every 10 seconds
    }

    const updatePresence = async (userId: string, isOnline: boolean) => {
      const now = new Date().toISOString()
      try {
        const { error } = await supabase
          .from('user_presence')
          .upsert(
            {
              user_id: userId,
              is_online: isOnline,
              last_seen: now,
              updated_at: now
            },
            {
              onConflict: 'user_id'
            }
          )

        if (error) throw error
      } catch (error) {
        if (error instanceof Error && !error.message.includes('network')) {
          console.error('Presence update failed:', error.message)
        }
      }
    }

    // Handle page visibility changes
    const handleVisibilityChange = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (document.hidden) {
        void updatePresence(user.id, false)
      } else {
        void updatePresence(user.id, true)
      }
    }

    // Handle browser close/refresh
    const handleBeforeUnload = () => {
      const user = supabase.auth.getSession()
      // Use synchronous XHR to ensure it completes
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/presence/offline', false) // false makes it synchronous
      xhr.setRequestHeader('Content-Type', 'application/json')
      user.then(({ data: { session } }) => {
        if (session?.user) {
          xhr.send(JSON.stringify({ userId: session.user.id }))
        }
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Setup presence system
    void setupPresence()

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (heartbeatInterval) clearInterval(heartbeatInterval)
      if (stalePollInterval) clearInterval(stalePollInterval)
      if (presenceChannel) void presenceChannel.unsubscribe()
      
      // Set offline when component unmounts
      void supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          void updatePresence(user.id, false)
        }
      })
    }
  }, [supabase])

  return onlineUsers
} 