'use client'

import { useEffect } from 'react'
import { useSupabase } from '../supabase-provider'
import { useAvatar } from '../contexts/AvatarContext'
import { useName } from '../contexts/NameContext'
import { useUserStatus } from '../contexts/UserStatusContext'
import { profileCache } from '../utils/profileCache'
import { useDebounce } from '../hooks/useDebounce'

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

export default function UserAvatar({
  userId,
  size = 'md',
  showStatus = false,
  online = false
}: UserAvatarProps) {
  const { getAvatarUrl, loadAvatarUrl } = useAvatar()
  const { getUsername, loadUsername } = useName()
  const { status, refresh } = useUserStatus(userId.toString())
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

  useEffect(() => {
    if (!showStatus) return;
    
    const loadData = async () => {
      await Promise.all([
        loadAvatarUrl(userId.toString()),
        loadUsername(userId.toString()),
        refresh()
      ]);
    };

    loadData();

    const intervalId = setInterval(() => {
      refresh();
    }, 60000);

    return () => clearInterval(intervalId);
  }, [userId, showStatus]);

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
        <>
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
          {status && (
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
              {STATUS_EMOJIS[status as keyof typeof STATUS_EMOJIS]}
            </div>
          )}
        </>
      )}
      <div className="sr-only">
        Status: {online ? 'online' : 'offline'} for user {userId}
      </div>
    </div>
  )
} 