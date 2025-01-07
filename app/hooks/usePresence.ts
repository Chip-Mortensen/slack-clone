import { useEffect } from 'react'
import { useSupabase } from '../supabase-provider'

const PRESENCE_INTERVAL = 15000 // 15 seconds

export function usePresence(userId: string | undefined) {
  const { supabase } = useSupabase()

  useEffect(() => {
    if (!userId) return

    let interval: NodeJS.Timeout
    let mounted = true

    async function updatePresence() {
      if (!mounted) return

      try {
        const { error } = await supabase
          .from('user_presence')
          .upsert(
            {
              user_id: userId,
              is_online: true,
              last_seen: new Date().toISOString()
            },
            {
              onConflict: 'user_id',
              ignoreDuplicates: false
            }
          )

        if (error) {
          throw error
        }
      } catch (error) {
        console.error('Error updating presence:', error)
      }
    }

    updatePresence()
    interval = setInterval(updatePresence, PRESENCE_INTERVAL)

    const handleBeforeUnload = async () => {
      try {
        await supabase
          .from('user_presence')
          .update({
            is_online: false,
            last_seen: new Date().toISOString()
          })
          .eq('user_id', userId)
      } catch (error) {
        console.error('Error updating offline status:', error)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      mounted = false
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      handleBeforeUnload()
    }
  }, [userId, supabase])
} 