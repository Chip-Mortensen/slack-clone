'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSupabase } from '../supabase-provider'
import { useAvatar } from '../contexts/AvatarContext'
import { useName } from '../contexts/NameContext'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useUserStatus } from '../contexts/UserStatusContext'

const STATUS_EMOJIS = {
  in_meeting: '🗓️',
  commuting: '🚗'
} as const

interface UserAvatarProps {
  userId: string | number
  size?: 'sm' | 'md' | 'lg'
  showStatus?: boolean
  online?: boolean
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
  size = 'md',
  showStatus = false,
  online = false
}: UserAvatarProps) {
  const { supabase } = useSupabase()
  const [userStatus, setUserStatus] = useState<string | null>(null)
  const { getAvatarUrl, loadAvatarUrl } = useAvatar()
  const { getUsername, loadUsername } = useName()
  const realtimeAvatarUrl = getAvatarUrl(userId.toString())
  const username = getUsername(userId.toString()) || 'Loading...'

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  const presenceDotClasses = {
    sm: 'w-2 h-2 border',
    md: 'w-2.5 h-2.5 border-2',
    lg: 'w-3 h-3 border-2'
  }

  const checkAndUpdateStatus = useCallback(async () => {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('user_statuses')
      .select('status_type, expires_at')
      .eq('user_id', userId)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)

    if (data?.[0]) {
      setUserStatus(data[0].status_type)
    } else {
      setUserStatus(null)
    }
  }, [supabase, userId])

  useEffect(() => {
    // Initial fetch
    checkAndUpdateStatus()
    
    // Set up real-time subscription for status updates
    const channel = supabase
      .channel(`user_status_${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_statuses',
        filter: `user_id=eq.${userId}`
      }, () => {
        checkAndUpdateStatus()
      })
      .subscribe()

    // Check more frequently - every 10 seconds during testing
    const intervalId = setInterval(() => {
      checkAndUpdateStatus()
    }, 10000) // 10 seconds for testing, change back to 60000 for production

    return () => {
      supabase.removeChannel(channel)
      clearInterval(intervalId)
    }
  }, [supabase, userId, checkAndUpdateStatus])

  useEffect(() => {
    loadAvatarUrl(userId.toString())
    loadUsername(userId.toString())
  }, [userId, loadAvatarUrl, loadUsername])

  return (
    <div className="relative inline-block">
      <div className={`${sizeClasses[size]} rounded-lg bg-gray-200 overflow-hidden`}>
        {realtimeAvatarUrl && (
          <img
            src={realtimeAvatarUrl}
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
            ${online 
              ? 'bg-green-500 border-white' 
              : 'bg-white border-green-500'
            }
            z-10
            shadow-sm
          `}
          style={{
            outline: '1px solid rgba(0,0,0,0.1)',
            transform: 'translate(25%, 25%)'
          }}
          title={online ? 'Online' : 'Offline'}
        />
      )}
      {userStatus && (
        <div 
          className="absolute bg-white rounded-full flex items-center justify-center text-xs border border-gray-200"
          style={{ 
            width: sizeClasses[size].match(/\d+/)?.[0] ? `${parseInt(sizeClasses[size].match(/\d+/)?.[0] || '0') / 2}px` : '16px',
            height: sizeClasses[size].match(/\d+/)?.[0] ? `${parseInt(sizeClasses[size].match(/\d+/)?.[0] || '0') / 2}px` : '16px',
            top: '-4px',
            left: '50%',
            transform: 'translateX(-50%)'
          }}
        >
          {STATUS_EMOJIS[userStatus as keyof typeof STATUS_EMOJIS]}
        </div>
      )}
      <div className="sr-only">
        Status: {online ? 'online' : 'offline'} for user {userId}
      </div>
    </div>
  )
} 