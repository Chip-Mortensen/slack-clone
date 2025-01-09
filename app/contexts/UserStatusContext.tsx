'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSupabase } from '../supabase-provider'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type UserStatus = {
  userId: string
  statusType: 'in_meeting' | 'commuting' | null
}

type UserStatusContextType = {
  statuses: Map<string, UserStatus>
  refreshStatus: (userId: string) => Promise<void>
}

const UserStatusContext = createContext<UserStatusContextType | null>(null)

interface StatusRow {
  user_id: string
  status_type: string
  expires_at: string
}

export function UserStatusProvider({ children }: { children: React.ReactNode }) {
  const { supabase } = useSupabase()
  const [statuses, setStatuses] = useState<Map<string, UserStatus>>(new Map())
  const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set())

  const refreshStatus = async (userId: string) => {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('user_statuses')
      .select('status_type, expires_at, user_id')
      .eq('user_id', userId)
      .gt('expires_at', now) // Only get non-expired status
      .order('created_at', { ascending: false })
      .limit(1)

    setStatuses(prev => {
      const next = new Map(prev)
      next.set(userId, { 
        userId, 
        statusType: data?.[0]?.status_type || null 
      })
      return next
    })
  }

  // Initial fetch of active statuses
  useEffect(() => {
    async function fetchActiveStatuses() {
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('user_statuses')
        .select('user_id, expires_at')
        .gt('expires_at', now) // Only get non-expired statuses

      if (data) {
        const userIds = new Set(data.map(status => status.user_id))
        setActiveUserIds(userIds)
        userIds.forEach(userId => refreshStatus(userId))
      }
    }

    fetchActiveStatuses()
  }, [supabase])

  useEffect(() => {
    const channel = supabase
      .channel('user_statuses')
      .on<StatusRow>(
        'postgres_changes' as const,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_status'
        },
        (payload: RealtimePostgresChangesPayload<StatusRow>) => {
          const newStatus = payload.new as StatusRow
          if (newStatus?.user_id) {
            setActiveUserIds(prev => new Set(prev).add(newStatus.user_id))
            refreshStatus(newStatus.user_id)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'user_statuses'
        },
        async () => {
          activeUserIds.forEach(userId => refreshStatus(userId))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, activeUserIds])

  // Check for expired statuses every minute
  useEffect(() => {
    const interval = setInterval(() => {
      activeUserIds.forEach(userId => refreshStatus(userId))
    }, 60000)

    return () => clearInterval(interval)
  }, [activeUserIds])

  return (
    <UserStatusContext.Provider value={{ statuses, refreshStatus }}>
      {children}
    </UserStatusContext.Provider>
  )
}

export function useUserStatus(userId: string) {
  const context = useContext(UserStatusContext)
  if (!context) {
    throw new Error('useUserStatus must be used within a UserStatusProvider')
  }

  const status = context.statuses.get(userId)?.statusType || null
  const refresh = () => context.refreshStatus(userId)

  return { status, refresh }
} 