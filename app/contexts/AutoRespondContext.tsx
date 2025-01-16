'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSupabase } from '../supabase-provider'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface AutoRespondContextType {
  getAutoRespondStatus: (userId: string) => boolean
  loadAutoRespondStatus: (userId: string) => Promise<void>
}

interface ProfileRow {
  id: string
  auto_respond: boolean
}

const AutoRespondContext = createContext<AutoRespondContextType | undefined>(undefined)

export function AutoRespondContextProvider({ children }: { children: React.ReactNode }) {
  const { supabase } = useSupabase()
  const [autoRespondStatuses, setAutoRespondStatuses] = useState<Record<string, boolean>>({})
  const [loadingStatuses, setLoadingStatuses] = useState<Set<string>>(new Set())

  // Initial load of all auto-respond statuses
  useEffect(() => {
    async function loadInitialStatuses() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, auto_respond')
          .eq('auto_respond', true)

        if (error) throw error

        if (data) {
          const statusMap = data.reduce((acc, { id, auto_respond }) => ({
            ...acc,
            [id]: auto_respond
          }), {})
          
          setAutoRespondStatuses(statusMap)
        }
      } catch (error) {
        console.error('Error loading initial auto-respond statuses:', error)
      }
    }

    loadInitialStatuses()
  }, [supabase])

  const loadAutoRespondStatus = async (userId: string) => {
    // Don't fetch if we're already loading it
    if (loadingStatuses.has(userId)) return
    
    setLoadingStatuses(prev => new Set(prev).add(userId))
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('auto_respond')
        .eq('id', userId)
        .single()
        
      if (error) throw error
      
      if (data) {
        setAutoRespondStatuses(prev => ({
          ...prev,
          [userId]: data.auto_respond
        }))
      }
    } catch (error) {
      console.error('Error loading auto-respond status:', error)
    } finally {
      setLoadingStatuses(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  // Listen for real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('auto_respond_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
      }, (payload: RealtimePostgresChangesPayload<ProfileRow>) => {
        const newData = payload.new as ProfileRow
        if (!newData?.id || typeof newData.auto_respond !== 'boolean') {
          return
        }
        setAutoRespondStatuses(prev => ({
          ...prev,
          [newData.id]: newData.auto_respond
        }))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const getAutoRespondStatus = (userId: string) => {
    return autoRespondStatuses[userId] || false
  }

  return (
    <AutoRespondContext.Provider value={{ getAutoRespondStatus, loadAutoRespondStatus }}>
      {children}
    </AutoRespondContext.Provider>
  )
}

export function useAutoRespond() {
  const context = useContext(AutoRespondContext)
  if (!context) {
    throw new Error('useAutoRespond must be used within an AutoRespondContextProvider')
  }
  return context
} 