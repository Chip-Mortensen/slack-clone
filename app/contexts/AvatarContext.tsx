'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSupabase } from '../supabase-provider'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface AvatarContextType {
  getAvatarUrl: (userId: string) => string | null
  loadAvatarUrl: (userId: string) => Promise<void>
}

interface ProfileRow {
  id: string
  avatar_url: string
}

const AvatarContext = createContext<AvatarContextType | undefined>(undefined)

export function AvatarContextProvider({ children }: { children: React.ReactNode }) {
  const { supabase } = useSupabase()
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({})
  const [loadingAvatars, setLoadingAvatars] = useState<Set<string>>(new Set())

  // Initial load of all avatar URLs
  useEffect(() => {
    async function loadInitialAvatars() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, avatar_url')
          .not('avatar_url', 'is', null)

        if (error) throw error

        if (data) {
          const urlMap = data.reduce((acc, { id, avatar_url }) => ({
            ...acc,
            [id]: avatar_url
          }), {})
          
          setAvatarUrls(urlMap)
        }
      } catch (error) {
        console.error('Error loading initial avatars:', error)
      }
    }

    loadInitialAvatars()
  }, [supabase])

  const loadAvatarUrl = async (userId: string) => {
    // Don't fetch if we already have it or are loading it
    if (avatarUrls[userId] || loadingAvatars.has(userId)) return
    
    setLoadingAvatars(prev => new Set(prev).add(userId))
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single()
        
      if (error) throw error
      
      if (data?.avatar_url) {
        setAvatarUrls(prev => ({
          ...prev,
          [userId]: data.avatar_url
        }))
      }
    } catch (error) {
      console.error('Error loading avatar:', error)
    } finally {
      setLoadingAvatars(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel('avatar_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
      }, (payload) => {
        const newData = payload.new as ProfileRow
        const { id, avatar_url } = newData
        if (avatar_url) {
          setAvatarUrls(prev => ({
            ...prev,
            [id]: avatar_url
          }))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const getAvatarUrl = (userId: string) => {
    return avatarUrls[userId] || null
  }

  return (
    <AvatarContext.Provider value={{ getAvatarUrl, loadAvatarUrl }}>
      {children}
    </AvatarContext.Provider>
  )
}

export function useAvatar() {
  const context = useContext(AvatarContext)
  if (!context) {
    throw new Error('useAvatar must be used within an AvatarContextProvider')
  }
  return context
} 