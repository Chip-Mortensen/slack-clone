'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useSupabase } from '../supabase-provider'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { profileCache } from '../utils/profileCache'
import { requestDeduplicator } from '../utils/requestDeduplication'

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
  const activeUserIdsRef = useRef<Set<string>>(new Set())
  const pendingRefreshes = useRef<Set<string>>(new Set())
  const statusIdToUserIdRef = useRef<Map<string, string>>(new Map())

  const refreshStatus = useCallback(async (userId: string) => {
    // Prevent duplicate refreshes
    if (pendingRefreshes.current.has(userId)) return;
    
    // Check cache first
    const cached = profileCache.get(`status_${userId}`);
    if (cached) {
      setStatuses(prev => {
        if (prev.get(userId)?.statusType === cached) return prev;
        const next = new Map(prev);
        next.set(userId, { userId, statusType: cached });
        return next;
      });
      return;
    }

    pendingRefreshes.current.add(userId);
    
    try {
      const { data, error } = await supabase
        .from('user_statuses')
        .select('status_type, expires_at')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching status:', error);
        return;
      }

      const statusType = data?.status_type || null;
      profileCache.set(`status_${userId}`, statusType);
      
      setStatuses(prev => {
        if (prev.get(userId)?.statusType === statusType) return prev;
        const next = new Map(prev);
        next.set(userId, { userId, statusType });
        return next;
      });
    } finally {
      pendingRefreshes.current.delete(userId);
    }
  }, [supabase]);

  // Batch refresh function
  const refreshStatuses = useCallback(async (userIds: string[]) => {
    const now = new Date().toISOString()
    const uniqueIds = Array.from(new Set(userIds)).filter(id => !pendingRefreshes.current.has(id))
    
    if (uniqueIds.length === 0) return

    uniqueIds.forEach(id => pendingRefreshes.current.add(id))

    try {
      const { data } = await supabase
        .from('user_statuses')
        .select('status_type, expires_at, user_id')
        .in('user_id', uniqueIds)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })

      const latestStatuses = new Map()
      data?.forEach(status => {
        if (!latestStatuses.has(status.user_id)) {
          latestStatuses.set(status.user_id, status.status_type)
          profileCache.set(`status_${status.user_id}`, status.status_type)
        }
      })

      setStatuses(prev => {
        const next = new Map(prev)
        uniqueIds.forEach(userId => {
          next.set(userId, {
            userId,
            statusType: latestStatuses.get(userId) || null
          })
        })
        return next
      })
    } finally {
      uniqueIds.forEach(id => pendingRefreshes.current.delete(id))
    }
  }, [supabase])

  // Initial fetch of active statuses
  useEffect(() => {
    let mounted = true

    async function fetchActiveStatuses() {
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('user_statuses')
        .select('user_id, expires_at')
        .gt('expires_at', now)

      if (data && mounted) {
        const userIds = data.map(status => status.user_id)
        activeUserIdsRef.current = new Set(userIds)
        await refreshStatuses(userIds)
      }
    }

    fetchActiveStatuses()
    return () => { mounted = false }
  }, [supabase, refreshStatuses])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('user_statuses')
      .on<StatusRow>(
        'postgres_changes' as const,
        {
          event: '*',
          schema: 'public',
          table: 'user_statuses'
        },
        async (payload: RealtimePostgresChangesPayload<StatusRow>) => {
          console.log('Status change received:', payload);

          // For INSERT/UPDATE events
          if (payload.new && 'user_id' in payload.new && 'id' in payload.new) {
            const userId = payload.new.user_id as string;
            const statusId = payload.new.id as string;
            console.log('Storing status mapping:', statusId, userId);
            statusIdToUserIdRef.current.set(statusId, userId);
            activeUserIdsRef.current.add(userId);
            await refreshStatus(userId);
          }

          // For DELETE events
          if (payload.eventType === 'DELETE' && payload.old && 'id' in payload.old) {
            const statusId = payload.old.id as string;
            const userId = statusIdToUserIdRef.current.get(statusId);
            console.log('DELETE event - found userId:', userId, 'for status:', statusId);
            
            if (userId) {
              console.log('Clearing status for user:', userId);
              profileCache.set(`status_${userId}`, null);
              statusIdToUserIdRef.current.delete(statusId);
              
              setStatuses(prev => {
                const next = new Map(prev);
                next.set(userId, { userId, statusType: null });
                return next;
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refreshStatus]);

  return (
    <UserStatusContext.Provider value={{ statuses, refreshStatus }}>
      {children}
    </UserStatusContext.Provider>
  )
}

export function useUserStatus(userId: string) {
  const context = useContext(UserStatusContext)
  if (!context) throw new Error('useUserStatus must be used within UserStatusProvider')
  const { statuses, refreshStatus } = context
  
  return {
    status: statuses.get(userId)?.statusType || null,
    refresh: () => refreshStatus(userId)
  }
} 