'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '../supabase-provider'
import type { User } from '@supabase/auth-helpers-nextjs'

export default function DashboardClient({
  user: initialUser,
}: {
  user: User
}) {
  const router = useRouter()
  const { supabase } = useSupabase()
  const [user] = useState<User>(initialUser)
  const [signOutLoading, setSignOutLoading] = useState(false)

  const handleSignOut = async () => {
    try {
      setSignOutLoading(true)
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to sign out')
      }

      router.refresh()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setSignOutLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    try {
      return new Date(dateString).toLocaleString()
    } catch (error) {
      return 'Invalid date'
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <button
            onClick={handleSignOut}
            disabled={signOutLoading}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signOutLoading ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Welcome!</h2>
          <div className="space-y-2">
            <p>Email: {user.email}</p>
            <p>Last Sign In: {formatDate(user.last_sign_in_at)}</p>
          </div>
        </div>
      </div>
    </div>
  )
} 