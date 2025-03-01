'use client'

import { useState, useEffect } from 'react'
import { X, Wand2 } from 'lucide-react'
import { useSupabase } from '../supabase-provider'
import type { Profile } from '@/app/types'

const STATUS_OPTIONS = [
  {
    id: 'in_meeting',
    label: '🗓️ In a meeting',
    duration: 60 * 60 * 1000, // 1 hour in milliseconds
  },
  {
    id: 'commuting',
    label: '🚗 Commuting',
    duration: 30 * 60 * 1000, // 30 minutes in milliseconds
  }
] as const

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
  profile: Profile
  onUpdate: () => Promise<void>
}

export default function EditProfileModal({
  isOpen,
  onClose,
  profile,
  onUpdate
}: EditProfileModalProps) {
  const { supabase } = useSupabase()
  const [username, setUsername] = useState(profile.username)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]['id'] | ''>('')
  const [autoRespond, setAutoRespond] = useState(profile.auto_respond || false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatingAvatar, setGeneratingAvatar] = useState(false)

  useEffect(() => {
    async function fetchCurrentStatus() {
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('user_statuses')
        .select('status_type, expires_at')
        .eq('user_id', profile.id)
        .gt('expires_at', now) // Only get non-expired status
        .order('created_at', { ascending: false })
        .limit(1)

      if (data?.[0]) {
        setStatus(data[0].status_type)
      } else {
        setStatus('')
      }
    }

    fetchCurrentStatus()
  }, [profile.id, supabase])

  useEffect(() => {
    setAutoRespond(profile.auto_respond || false)
  }, [profile.auto_respond])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Update profile
      console.log('Updating profile with auto_respond:', autoRespond)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username,
          avatar_url: avatarUrl,
          auto_respond: autoRespond,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)

      console.log('Profile update response:', { error: profileError })

      if (profileError) throw profileError

      // Handle status changes
      const { data: currentStatus } = await supabase
        .from('user_statuses')
        .select('id')
        .eq('user_id', profile.id)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      console.log('Current status:', currentStatus)

      // Delete existing status if it exists
      if (currentStatus?.id) {
        console.log('Deleting status:', currentStatus.id)
        const { data, error: deleteError } = await supabase
          .from('user_statuses')
          .delete()
          .match({ id: currentStatus.id, user_id: profile.id })
          .select('id, user_id, status_type')

        console.log('Delete response:', { data, error: deleteError })
        if (deleteError) throw deleteError
      }

      // Add new status if selected
      if (status) {
        console.log('Setting new status:', status)
        const statusOption = STATUS_OPTIONS.find(opt => opt.id === status)
        if (statusOption) {
          const expiresAt = new Date(Date.now() + statusOption.duration).toISOString()
          const { data, error: statusError } = await supabase
            .from('user_statuses')
            .insert({
              user_id: profile.id,
              status_type: status,
              expires_at: expiresAt
            })

          console.log('Insert response:', { data, error: statusError })
          if (statusError) throw statusError
        }
      }

      await onUpdate()
      onClose()
    } catch (error) {
      console.error('Error in handleSubmit:', error)
      setError(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0]
      if (!file) return

      const fileExt = file.name.split('.').pop()
      const filePath = `${profile.id}-${Math.random()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setAvatarUrl(publicUrl)
    } catch (error) {
      console.error('Error uploading avatar:', error)
      setError(error instanceof Error ? error.message : 'Failed to upload avatar')
    }
  }

  const handleGenerateAvatar = async () => {
    if (!profile?.id || generatingAvatar) return
    
    setGeneratingAvatar(true)
    try {
      const response = await fetch('/api/generate-profile-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: profile.id }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate avatar')
      }

      // Update local state immediately
      setAvatarUrl(data.avatarUrl)
      await onUpdate()
    } catch (error) {
      console.error('Error generating avatar:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate avatar')
    } finally {
      setGeneratingAvatar(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Profile</h2>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Avatar
            </label>
            <div className="flex flex-col space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                  {avatarUrl && (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500">
                    Upload a picture or generate an AI avatar
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm
                  leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                  cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="sr-only"
                  />
                  Choose File
                </label>
                
                <button
                  type="button"
                  onClick={handleGenerateAvatar}
                  disabled={generatingAvatar}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm
                    leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                    disabled:opacity-50"
                >
                  {generatingAvatar ? (
                    <>
                      <div className="animate-spin mr-2">⌛</div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 size={16} className="mr-2" />
                      Generate AI Avatar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No status</option>
              {STATUS_OPTIONS.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              AI Auto-Response
            </label>
            <button
              type="button"
              onClick={() => setAutoRespond(!autoRespond)}
              className={`
                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${autoRespond ? 'bg-blue-500' : 'bg-gray-200'}
              `}
            >
              <span className="sr-only">Enable auto-response</span>
              <span
                className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                  transition duration-200 ease-in-out
                  ${autoRespond ? 'translate-x-5' : 'translate-x-0'}
                `}
              />
            </button>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 