'use client'

import { Hash, MessageSquare, Search } from 'lucide-react'
import type { Channel, Message, Conversation, DirectMessage } from '@/app/types/models'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import UserAvatar from './UserAvatar'
import SearchMessages from './SearchMessages'
import ThreadSidebar from './ThreadSidebar'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useScrollManager } from '../hooks/useScrollManager'
import DirectMessageHeader from './DirectMessageHeader'

interface ChatAreaProps {
  currentChannel: Channel | null
  currentConversation: Conversation | null
  messages: (Message | DirectMessage)[]
  onSendMessage: (e: React.FormEvent, fileInfo?: { url: string, name: string }) => Promise<void>
  newMessage: string
  setNewMessage: (message: string) => void
  hasMore: boolean
  loadMore: () => void
  loading: boolean
  onChannelSelect: (channelId: string | number, source?: 'search' | 'navigation') => Promise<{ promise?: Promise<void>, source?: 'search' | 'navigation' }>
  onConversationSelect: (conversationId: string | number, source?: 'search' | 'navigation') => Promise<{ promise?: Promise<void>, source?: 'search' | 'navigation' }>
  channels: Channel[]
  conversations: Conversation[]
  initialLoadPromise?: Promise<void> | null
  navigationSource: 'sidebar' | 'search' | null
  setNavigationSource: (source: 'sidebar' | 'search' | null) => void
  onlineUsers?: string[]
}

export default function ChatArea({
  currentChannel,
  currentConversation,
  messages,
  onSendMessage,
  newMessage,
  setNewMessage,
  hasMore,
  loadMore,
  loading,
  onChannelSelect,
  onConversationSelect,
  channels,
  conversations,
  initialLoadPromise,
  navigationSource,
  setNavigationSource,
  onlineUsers = []
}: ChatAreaProps) {
  const [parentMessage, setParentMessage] = useState<Message | null>(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | number | null>(null)
  const [contextSwitchSource, setContextSwitchSource] = useState<'search' | 'navigation'>('navigation')
  const searchModeRef = useRef(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchCompleteRef = useRef<NodeJS.Timeout | null>(null)
  const messagesRef = useRef<(Message | DirectMessage)[]>([])
  const preventAutoScroll = useRef(false)
  const [isSearchNavigation, setIsSearchNavigation] = useState(false)
  const { scrollToBottom } = useScrollManager()

  // Keep messagesRef in sync
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Close thread when channel or conversation changes
  useEffect(() => {
    setParentMessage(null)
    setHighlightedMessageId(null) // Reset highlighted message when changing channels
  }, [currentChannel?.id, currentConversation?.id])

  const handleSearchStateChange = useCallback((isSearching: boolean) => {
    if (isSearching) {
      setIsSearchNavigation(true)
    }
  }, [])

  const handleMessageSelect = async (messageId: string | number, context: {
    type: 'channel' | 'conversation'
    id: string | number
  }) => {
    // Clear previous states
    setHighlightedMessageId(null)
    setNavigationSource('search')
    
    try {
      const isCurrentContext = (
        (context.type === 'channel' && currentChannel?.id === context.id) ||
        (context.type === 'conversation' && currentConversation?.id === context.id)
      )

      if (!isCurrentContext) {
        if (context.type === 'channel') {
          await onChannelSelect(context.id, 'search')
        } else {
          await onConversationSelect(context.id, 'search')
        }
        // Add small delay to ensure context switch is complete
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      setHighlightedMessageId(messageId)
    } catch (error) {
      console.error('Error selecting message:', error)
      setNavigationSource('sidebar') // This will trigger cleanup
    }
  }

  const handleSubmit = async (e: React.FormEvent, fileInfo?: { url: string, name: string }) => {
    e.preventDefault()
    if (!newMessage.trim() && !fileInfo) return

    try {
      await onSendMessage(e, fileInfo)
      setNewMessage('')
      
      // Use the scroll manager for consistent behavior
      const messagesContainer = document.querySelector('.messages-container') as HTMLElement
      if (messagesContainer) {
        // Force scroll to bottom after sending
        requestAnimationFrame(() => {
          scrollToBottom(messagesContainer, { force: true, behavior: 'smooth' })
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const getHeaderContent = () => {
    if (currentChannel) {
      return (
        <>
          <Hash size={20} className="text-gray-400 mr-2" />
          <h2 className="text-lg font-bold">
            {currentChannel.name}
          </h2>
        </>
      )
    }
    if (currentConversation) {
      return (
        <DirectMessageHeader conversation={currentConversation} onlineUsers={onlineUsers} />
      )
    }
    return <h2 className="text-lg font-bold">Select a channel or conversation</h2>
  }

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (searchCompleteRef.current) {
        clearTimeout(searchCompleteRef.current)
      }
    }
  }, [])

  // Single effect to handle all navigation and search state changes
  useEffect(() => {
    if (navigationSource === 'sidebar') {
      // Clear all search-related states
      setIsSearching(false)
      setIsSearchNavigation(false)
      setHighlightedMessageId(null)
      preventAutoScroll.current = false
    } else if (navigationSource === 'search') {
      // Ensure search states are set
      setIsSearching(true)
      setIsSearchNavigation(true)
    }
  }, [navigationSource, currentChannel?.id, currentConversation?.id])

  return (
    <div className="flex-1 flex">
      <div className="flex-1 flex flex-col">
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 bg-white">
          <div className="flex items-center">
            {getHeaderContent()}
          </div>
          <SearchMessages 
            channelId={currentChannel?.id} 
            conversationId={currentConversation?.id}
            onMessageSelect={handleMessageSelect}
            onSearchStateChange={handleSearchStateChange}
            channels={channels}
            conversations={conversations}
          />
        </div>

        <MessageList 
          messages={messages}
          hasMore={hasMore}
          loadMore={loadMore}
          loading={loading}
          showThreads={!!currentChannel}
          onReplyClick={setParentMessage}
          highlightedMessageId={highlightedMessageId}
          isSearchNavigation={isSearchNavigation}
          navigationSource={navigationSource}
          onlineUsers={onlineUsers}
        />

        <MessageInput
          onSubmit={handleSubmit}
          value={newMessage}
          onChange={setNewMessage}
          onSendComplete={() => {
            const container = document.querySelector('.messages-container')
            if (container) {
              container.scrollTop = container.scrollHeight
            }
          }}
        />
      </div>

      {parentMessage && (
        <ThreadSidebar
          parentMessage={parentMessage}
          onClose={() => setParentMessage(null)}
        />
      )}
    </div>
  )
} 