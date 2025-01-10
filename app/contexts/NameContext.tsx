'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSupabase } from '../supabase-provider'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface NameContextType {
  getUsername: (userId: string) => string | null
  loadUsername: (userId: string) => Promise<void>
}

interface ProfileRow {
  id: string
  username: string
}

type PostgresChanges = {
  new: ProfileRow
}

const NameContext = createContext<NameContextType | undefined>(undefined)

export function NameContextProvider({ children }: { children: React.ReactNode }) {
  const { supabase } = useSupabase()
  const [usernames, setUsernames] = useState<Record<string, string | null>>({})
  const [loadingNames, setLoadingNames] = useState<Set<string>>(new Set())

  // Initial load of all usernames
  useEffect(() => {
    async function loadInitialNames() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username')
          .not('username', 'is', null)

        if (error) throw error

        if (data) {
          const nameMap = data.reduce((acc, { id, username }) => ({
            ...acc,
            [id]: username
          }), {})
          
          setUsernames(nameMap)
        }
      } catch (error) {
        console.error('Error loading initial usernames:', error)
      }
    }

    loadInitialNames()
  }, [supabase])

  const loadUsername = async (userId: string) => {
    if (usernames[userId] || loadingNames.has(userId)) return
    
    setLoadingNames(prev => new Set(prev).add(userId))
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single()
        
      if (error) throw error
      
      if (data?.username) {
        setUsernames(prev => ({
          ...prev,
          [userId]: data.username
        }))
      }
    } catch (error) {
      console.error('Error loading username:', error)
    } finally {
      setLoadingNames(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel('username_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
      }, (payload) => {
        console.log('Profile change received:', payload)
        const newData = payload.new as ProfileRow
        const { id, username } = newData
        setUsernames(prev => ({
          ...prev,
          [id]: username || null
        }))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const getUsername = (userId: string) => {
    if (!(userId in usernames)) {
      loadUsername(userId)
      return null
    }
    return usernames[userId]
  }

  return (
    <NameContext.Provider value={{ getUsername, loadUsername }}>
      {children}
    </NameContext.Provider>
  )
}

export function useName() {
  const context = useContext(NameContext)
  if (!context) {
    throw new Error('useName must be used within a NameContextProvider')
  }
  return context
} 