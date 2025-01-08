'use client'

import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { useSupabase } from '../supabase-provider'
import type { Message, DirectMessage, Channel, Conversation } from '@/app/types'
import { useDebounce } from '../hooks/useDebounce'

interface SearchMessagesProps {
  channelId?: string | null
  conversationId?: number | null
  onMessageSelect?: (messageId: string | number, context: { 
    type: 'channel' | 'conversation', 
    id: string | number 
  }) => void
  channels: Channel[]
  conversations: Conversation[]
}

export default function SearchMessages({ 
  channelId, 
  conversationId, 
  onMessageSelect,
  channels,
  conversations 
}: SearchMessagesProps) {
  const { supabase } = useSupabase()
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<(Message | DirectMessage)[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const debouncedSearch = useDebounce(searchTerm, 300)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Parse search context from search term
  const parseSearchContext = (term: string): { 
    context: 'channel' | 'conversation' | 'global',
    contextId?: string | number,
    searchText: string 
  } => {
    const channelMatch = term.match(/^#([^\s]+)\s(.+)/)
    const userMatch = term.match(/^@([^\s]+)\s(.+)/)

    if (channelMatch) {
      const channel = channels.find(c => c.name === channelMatch[1])
      return {
        context: 'channel',
        contextId: channel?.id,
        searchText: channelMatch[2]
      }
    }

    if (userMatch) {
      const conversation = conversations.find(c => 
        c.other_user.username === userMatch[1]
      )
      return {
        context: 'conversation',
        contextId: conversation?.id,
        searchText: userMatch[2]
      }
    }

    // Default to current context or global
    if (channelId) {
      return { context: 'channel', contextId: channelId, searchText: term }
    }
    if (conversationId) {
      return { context: 'conversation', contextId: conversationId, searchText: term }
    }

    return { context: 'global', searchText: term }
  }

  useEffect(() => {
    async function searchMessages() {
      if (!debouncedSearch.trim()) {
        setResults([])
        return
      }

      const { context, contextId, searchText } = parseSearchContext(debouncedSearch)

      try {
        if (context === 'channel') {
          const { data, error } = await supabase
            .from('messages')
            .select(`
              *,
              profiles (
                id,
                username,
                avatar_url
              ),
              channels (
                id,
                name
              )
            `)
            .eq(contextId ? 'channel_id' : '', contextId || '')
            .ilike('content', `%${searchText}%`)
            .order('created_at', { ascending: false })
            .limit(5)

          if (error) throw error
          setResults(data || [])
        } else if (context === 'conversation') {
          const { data, error } = await supabase
            .from('direct_messages')
            .select(`
              *,
              sender:profiles!direct_messages_sender_id_fkey (
                id,
                username,
                avatar_url
              ),
              conversation:conversations!inner (
                id,
                user1_id,
                user2_id
              )
            `)
            .eq(contextId ? 'conversation_id' : '', contextId || '')
            .ilike('message', `%${searchText}%`)
            .order('created_at', { ascending: false })
            .limit(5)

          if (error) throw error
          setResults(data || [])
        } else {
          // Global search - combine results from both tables
          const [messagesRes, directMessagesRes] = await Promise.all([
            supabase
              .from('messages')
              .select(`
                *,
                profiles (
                  id,
                  username,
                  avatar_url
                ),
                channels (
                  id,
                  name
                )
              `)
              .ilike('content', `%${searchText}%`)
              .order('created_at', { ascending: false })
              .limit(5),
            supabase
              .from('direct_messages')
              .select(`
                *,
                sender:profiles!direct_messages_sender_id_fkey (
                  id,
                  username,
                  avatar_url
                ),
                conversation:conversations!inner (
                  id,
                  user1_id,
                  user2_id
                )
              `)
              .ilike('message', `%${searchText}%`)
              .order('created_at', { ascending: false })
              .limit(5)
          ])

          if (messagesRes.error) throw messagesRes.error
          if (directMessagesRes.error) throw directMessagesRes.error

          setResults([...messagesRes.data, ...directMessagesRes.data]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5))
        }
      } catch (error) {
        console.error('Error searching messages:', error)
      }
    }

    searchMessages()
  }, [debouncedSearch, channelId, conversationId, channels, conversations, supabase])

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

  const getResultContext = (result: Message | DirectMessage): {
    type: 'channel' | 'conversation'
    id: string | number
    name: string
  } => {
    const isChannelMessage = 'profiles' in result
    if (isChannelMessage) {
      return {
        type: 'channel',
        id: (result as Message).channel_id,
        name: (result as Message).channels.name
      }
    }
    return {
      type: 'conversation',
      id: (result as DirectMessage).conversation_id,
      name: (result as DirectMessage).sender.username
    }
  }

  const handleResultClick = (result: Message | DirectMessage) => {
    const context = getResultContext(result)
    onMessageSelect?.(result.id, context)
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
            const context = getResultContext(result)

            return (
              <button
                key={result.id}
                onClick={() => handleResultClick(result)}
                className="w-full text-left p-2 hover:bg-gray-100"
              >
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-sm">{user.username}</span>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(result.created_at)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {context.type === 'channel' ? 
                      `#${context.name}` : 
                      `@${context.name}`
                    }
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