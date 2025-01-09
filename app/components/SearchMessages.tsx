'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSupabase } from '../supabase-provider'
import type { Channel, Conversation } from '@/app/types/models'
import type { SearchToken } from '@/app/types/search'
import SearchInput from './SearchInput'

interface SearchMessagesProps {
  channelId?: string | number | null
  conversationId?: string | number | null
  onMessageSelect: (messageId: string | number, context: { type: 'channel' | 'conversation', id: string | number }) => void
  channels: Channel[]
  conversations: Conversation[]
  onSearchStateChange: (isSearching: boolean) => void
}

interface ChannelResult {
  id: number
  content: string
  created_at: string
  channel_id: number
  user_id: string
  profiles: {
    username: string
  }
  channels: {
    name: string
  }
}

interface DMResult {
  id: number
  message: string
  created_at: string
  conversation_id: number
  sender_id: string
  conversations: {
    user1_id: string
    user2_id: string
  }
  sender: {
    username: string
  }
  receiver: {
    username: string
  }
}

export default function SearchMessages({ 
  channelId, 
  conversationId, 
  onMessageSelect, 
  onSearchStateChange,
  channels, 
  conversations 
}: SearchMessagesProps) {
  const [results, setResults] = useState<Array<{
    id: string | number
    content: string
    context: {
      type: 'channel' | 'conversation'
      id: string | number
    }
    channel?: string
    user: string
    timestamp: Date
  }>>([])
  const { supabase } = useSupabase()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const isSearchMode = useRef(false)

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }
    getCurrentUser()
  }, [supabase])

  const handleSearch = useCallback(async (tokens: SearchToken[]) => {
    // Get current user ID if we don't have it yet
    if (!currentUserId) {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }

    // No search if we only have context tokens
    if (!tokens.length || (tokens.length === 1 && tokens[0].type !== 'text')) {
      setResults([])
      return
    }

    // Get context from tokens
    const contextToken = tokens.find(t => t.type === 'channel' || t.type === 'user')
    const searchTerms = tokens
      .filter(t => t.type === 'text')
      .map(t => t.value)
      .join(' ')

    if (!searchTerms) {
      setResults([])
      return
    }

    try {
      let promises = []

      // Search in channel messages if not in conversation context
      if (!contextToken || contextToken.type === 'channel') {
        const channelQuery = supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            channel_id,
            user_id,
            profiles!messages_user_id_fkey (
              username
            ),
            channels!messages_channel_id_fkey (
              name
            )
          `)
          .ilike('content', `%${searchTerms}%`)

        if (contextToken?.type === 'channel' && contextToken.id) {
          channelQuery.eq('channel_id', contextToken.id)
        }

        promises.push(channelQuery)
      }

      // Search in direct messages if not in channel context
      if (!contextToken || contextToken.type === 'user') {
        const dmQuery = supabase
          .from('direct_messages')
          .select(`
            id,
            message,
            created_at,
            conversation_id,
            sender_id,
            conversations!inner (
              user1_id,
              user2_id
            ),
            sender:profiles!direct_messages_sender_id_fkey (
              username
            ),
            receiver:profiles!direct_messages_receiver_id_fkey (
              username
            )
          `)
          .ilike('message', `%${searchTerms}%`)

        if (contextToken?.type === 'user' && contextToken.id) {
          dmQuery.eq('conversation_id', contextToken.id)
        }

        promises.push(dmQuery)
      }

      const responses = await Promise.all(promises)
      const errors = responses.filter(r => r.error).map(r => r.error)
      if (errors.length > 0) {
        throw errors[0]
      }

      const allResults = responses.flatMap(r => {
        const data = r.data || []
        return (data as unknown as (ChannelResult | DMResult)[])
      })
        .map(result => {
          const isDirectMessage = 'message' in result
          const isSender = isDirectMessage && result.sender_id === currentUserId

          const mappedResult = {
            id: result.id,
            content: isDirectMessage ? result.message : result.content,
            context: {
              type: (isDirectMessage ? 'conversation' : 'channel') as 'channel' | 'conversation',
              id: isDirectMessage ? result.conversation_id : result.channel_id
            },
            channel: !isDirectMessage ? result.channels?.name : undefined,
            user: isDirectMessage 
              ? `${result.sender_id === currentUserId 
                  ? result.receiver?.username 
                  : result.sender?.username || 'Unknown'}${isSender ? ' (me)' : ''}`
              : (result.profiles?.username || 'Unknown'),
            timestamp: new Date(result.created_at)
          }
          
          return mappedResult
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

      setResults(allResults)
    } catch (error) {
      setResults([])
    }
  }, [supabase, currentUserId])

  const handleResultClick = (result: typeof results[0]) => {
    // Set search mode before navigation
    onSearchStateChange(true)
    onMessageSelect(result.id, result.context)
    setResults([])
  }

  // Clear search state when context changes
  useEffect(() => {
    onSearchStateChange(false)
  }, [channelId, conversationId, onSearchStateChange])

  return (
    <div className="relative">
      <SearchInput
        channels={channels}
        conversations={conversations}
        currentContext={
          channelId ? { type: 'channel', id: channelId } :
          conversationId ? { type: 'conversation', id: conversationId } :
          undefined
        }
        onSearch={handleSearch}
      />

      {/* Results dropdown */}
      {results.length > 0 && (
        <div className="absolute w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50">
          {results.map(result => (
            <button
              key={result.id}
              onClick={() => handleResultClick(result)}
              className="block w-full text-left p-2 hover:bg-gray-100"
            >
              <div className="flex items-center text-sm text-gray-500">
                {result.context.type === 'channel' ? (
                  <span>#{result.channel}</span>
                ) : (
                  <span>@{result.user}</span>
                )}
                <span className="mx-2">·</span>
                <span>{formatTimestamp(result.timestamp)}</span>
              </div>
              <div className="mt-1 text-sm">{result.content}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const formatTimestamp = (date: Date) => {
  const now = new Date()
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  
  if (diffInHours < 24) {
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  } else {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }
}