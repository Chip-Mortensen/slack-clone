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
  username,
  avatarUrl,
  size = 'md',
  showStatus = false,
  online = false
}: UserAvatarProps) {
  const { supabase } = useSupabase()

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
      <div className="sr-only">
        Status: {online ? 'online' : 'offline'} for user {userId}
      </div>
    </div>
  )
} 