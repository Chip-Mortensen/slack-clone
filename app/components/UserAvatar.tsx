'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '../supabase-provider'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useUserStatus } from '../contexts/UserStatusContext'

const STATUS_EMOJIS = {
  in_meeting: '🗓️',
  commuting: '🚗'
} as const

interface UserAvatarProps {
  userId: string | number
  username: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  showStatus?: boolean
}

interface UserPresence {
  is_online: boolean
  last_seen: string
}

interface PresenceRow {
  is_online: boolean
}

export default function UserAvatar({
  userId,
  username,
  avatarUrl,
  size = 'md',
  showStatus = false
}: UserAvatarProps) {
  const { supabase } = useSupabase()
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    if (!showStatus) return

    // Get initial presence state
    const getPresence = async () => {
      const { data } = await supabase
        .from('user_presence')
        .select('is_online')
        .eq('user_id', userId)
        .single()
      
      if (data && typeof data === 'object' && 'is_online' in data) {
        setIsOnline((data as PresenceRow).is_online)
      }
    }

    getPresence()

    // Subscribe to presence changes
    const channel = supabase
      .channel('presence-changes')
      .on<PresenceRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `user_id=eq.${userId}`
        },
        (payload: RealtimePostgresChangesPayload<PresenceRow>) => {
          if (payload.new && 'is_online' in payload.new) {
            setIsOnline(payload.new.is_online)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, showStatus])

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
      {showStatus && (
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