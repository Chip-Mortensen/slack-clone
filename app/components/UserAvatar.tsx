'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '../supabase-provider'
import { useUserStatus } from '../contexts/UserStatusContext'

const STATUS_EMOJIS = {
  in_meeting: '🗓️',
  commuting: '🚗'
} as const

interface UserAvatarProps {
  userId: string
  avatarUrl: string | null
  username: string
  size?: 'sm' | 'md' | 'lg'
  showStatus?: boolean
}

interface UserPresence {
  is_online: boolean
  last_seen: string
}

export default function UserAvatar({ 
  userId, 
  avatarUrl, 
  username,
  size = 'md',
  showStatus = true 
}: UserAvatarProps) {
  const { status } = useUserStatus(userId)
  const { supabase } = useSupabase()
  const [presence, setPresence] = useState<UserPresence | null>(null)

  useEffect(() => {
    let presenceChannel: ReturnType<typeof supabase.channel>
    let mounted = true

    async function setupPresence() {
      try {
        // Initial fetch with a small delay to handle race conditions
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const { data, error } = await supabase
          .from('user_presence')
          .select('is_online, last_seen')
          .eq('user_id', userId)
          .maybeSingle()

        if (error) {
          console.error('Error fetching presence:', error)
          return
        }

        if (data && mounted) {
          setPresence(data)
        }

        presenceChannel = supabase.channel(`presence:${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_presence',
              filter: `user_id=eq.${userId}`
            },
            (payload) => {
              if (!mounted) return
              
              if (payload.new) {
                setPresence(payload.new as UserPresence)
              } else if (payload.old && !payload.new) {
                setPresence(null)
              }
            }
          )
          .subscribe()
      } catch (error) {
        console.error('Error setting up presence:', error)
      }
    }

    if (userId) {
      setupPresence()
    }

    return () => {
      mounted = false
      if (presenceChannel) {
        supabase.removeChannel(presenceChannel)
      }
    }
  }, [userId, supabase])

  // Reduce stale timeout to 1 minute for more accurate presence
  const isPresenceStale = presence?.last_seen && 
    new Date().getTime() - new Date(presence.last_seen).getTime() > 60000

  const isOnline = presence?.is_online && !isPresenceStale

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  const statusSizeClasses = {
    sm: 'text-[10px] translate-y-[-50%]',
    md: 'text-xs translate-y-[-50%]',
    lg: 'text-sm translate-y-[-50%]'
  }

  const presenceDotClasses = {
    sm: 'w-2 h-2 border translate-x-1/3 translate-y-1/3',
    md: 'w-2.5 h-2.5 border-2 translate-x-1/3 translate-y-1/3',
    lg: 'w-3 h-3 border-2 translate-x-1/3 translate-y-1/3'
  }

  return (
    <div className="relative inline-block">
      <div className={`${sizeClasses[size]} rounded-lg bg-gray-200 overflow-hidden`}>
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt={username}
            className={`${sizeClasses[size]} object-cover`}
            onError={(e) => {
              console.error('Error loading image:', e)
              e.currentTarget.src = ''
            }}
          />
        )}
      </div>
      {showStatus && status && (
        <div 
          className={`
            absolute left-1/2 top-0 -translate-x-1/2
            ${statusSizeClasses[size]}
          `}
          title={status === 'in_meeting' ? 'In a meeting' : 'Commuting'}
        >
          {STATUS_EMOJIS[status]}
        </div>
      )}
      {presence !== null && (
        <div 
          className={`
            absolute bottom-0 right-0
            ${presenceDotClasses[size]}
            rounded-full
            ${isOnline
              ? 'bg-green-500 border-white' 
              : 'bg-white border-green-500'
            }
          `}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  )
} 