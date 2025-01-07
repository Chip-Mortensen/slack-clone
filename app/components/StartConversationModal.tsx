'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useSupabase } from '../supabase-provider'
import type { Profile } from '@/app/types'
import UserAvatar from './UserAvatar'

interface StartConversationModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (userId: string) => Promise<void>
}

export default function StartConversationModal({
  isOpen,
  onClose,
  onSubmit
}: StartConversationModalProps) {
  const { supabase } = useSupabase()
  const [searchTerm, setSearchTerm] = useState('')
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (value: string) => {
    setSearchTerm(value)
    if (value.length < 2) {
      setUsers([])
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${value}%`)
        .limit(5)

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectUser = async (userId: string) => {
    try {
      setError(null)
      setLoading(true)
      await onSubmit(userId)
      setSearchTerm('')
      setUsers([])
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start conversation')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Start a Conversation</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : users.length > 0 ? (
            users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                className="flex items-center w-full p-2 hover:bg-gray-100 rounded-md"
              >
                <UserAvatar
                  userId={user.id}
                  avatarUrl={user.avatar_url}
                  username={user.username}
                  size="md"
                />
                <span className="ml-2">{user.username}</span>
              </button>
            ))
          ) : searchTerm.length >= 2 ? (
            <div className="text-center text-gray-500">No users found</div>
          ) : null}
        </div>
      </div>
    </div>
  )
} 