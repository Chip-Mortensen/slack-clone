'use client'

import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { useSupabase } from '../supabase-provider'
import type { Message, DirectMessage } from '@/app/types'
import { useDebounce } from '../hooks/useDebounce'

interface SearchMessagesProps {
  channelId?: string | null
  conversationId?: number | null
  onMessageSelect?: (messageId: string | number) => void
}

export default function SearchMessages({ channelId, conversationId, onMessageSelect }: SearchMessagesProps) {
  const { supabase } = useSupabase()
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<(Message | DirectMessage)[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const debouncedSearch = useDebounce(searchTerm, 300)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function searchMessages() {
      if (!debouncedSearch.trim()) {
        setResults([])
        return
      }

      try {
        if (channelId) {
          const { data, error } = await supabase
            .from('messages')
            .select(`
              *,
              profiles (
                id,
                username,
                avatar_url
              )
            `)
            .eq('channel_id', channelId)
            .ilike('content', `%${debouncedSearch}%`)
            .order('created_at', { ascending: false })
            .limit(5)

          if (error) throw error
          setResults(data || [])
        } else if (conversationId) {
          const { data, error } = await supabase
            .from('direct_messages')
            .select(`
              *,
              sender:profiles!direct_messages_sender_id_fkey (
                id,
                username,
                avatar_url
              )
            `)
            .eq('conversation_id', conversationId)
            .ilike('message', `%${debouncedSearch}%`)
            .order('created_at', { ascending: false })
            .limit(5)

          if (error) throw error
          setResults(data || [])
        }
      } catch (error) {
        console.error('Error searching messages:', error)
      }
    }

    searchMessages()
  }, [debouncedSearch, channelId, conversationId, supabase])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const handleResultClick = (messageId: string | number) => {
    onMessageSelect?.(messageId)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center w-96 bg-gray-100 rounded-lg px-3 py-2">
        <Search size={18} className="text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setIsOpen(true)
          }}
          placeholder="Search messages..."
          className="w-full bg-transparent border-none focus:outline-none ml-2 text-sm"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50">
          {results.map((result) => {
            const isChannelMessage = 'profiles' in result
            const message = isChannelMessage ? result.content : result.message
            const user = isChannelMessage ? result.profiles : result.sender

            return (
              <button
                key={result.id}
                onClick={() => handleResultClick(result.id)}
                className="w-full text-left p-2 hover:bg-gray-100"
              >
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-sm">{user.username}</span>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(result.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-2">{message}</p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
} 