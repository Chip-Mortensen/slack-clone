'use client'

import { Hash, MessageSquare, Search } from 'lucide-react'
import type { Channel, Message, Conversation, DirectMessage } from '@/app/types/models'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import UserAvatar from './UserAvatar'
import SearchMessages from './SearchMessages'
import ThreadSidebar from './ThreadSidebar'
import { useState, useEffect, useRef, useCallback } from 'react'

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
    setNavigationSource('search')
    setIsSearching(true)
    setIsSearchNavigation(true)
    preventAutoScroll.current = true

    try {
      // Switch context if needed
      if (context.type === 'channel') {
        const result = await onChannelSelect(context.id, 'search')
        if (result?.promise) {
          await result.promise
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } else {
        const result = await onConversationSelect(context.id, 'search')
        if (result?.promise) {
          await result.promise
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      setHighlightedMessageId(messageId)
    } catch (error) {
      setNavigationSource(null)
      setIsSearching(false)
      setIsSearchNavigation(false)
      setHighlightedMessageId(null)
      preventAutoScroll.current = false
    }
  }

  const handleSubmit = async (e: React.FormEvent, fileInfo?: { url: string, name: string }) => {
    e.preventDefault()
    if (!newMessage.trim() && !fileInfo) return

    try {
      await onSendMessage(e, fileInfo)
      setNewMessage('')
      
      // Scroll to bottom after sending
      const messagesDiv = document.querySelector('.messages-container')
      if (messagesDiv) {
        setTimeout(() => {
          messagesDiv.scrollTop = messagesDiv.scrollHeight
        }, 100)
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
          <h2 className="text-lg font-medium">
            {currentChannel.name}
          </h2>
        </>
      )
    }
    if (currentConversation) {
      return (
        <>
          <MessageSquare size={20} className="text-gray-400 mr-2" />
          <div className="flex items-center">
            <UserAvatar
              userId={currentConversation.other_user.id}
              username={currentConversation.other_user.username}
              avatarUrl={currentConversation.other_user.avatar_url}
              size="md"
              showStatus={true}
              online={onlineUsers.includes(String(currentConversation.other_user.id))}
            />
            <span className="ml-2 font-medium">
              {currentConversation.other_user.username}
            </span>
          </div>
        </>
      )
    }
    return <h2 className="text-lg font-medium">Select a channel or conversation</h2>
  }

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (searchCompleteRef.current) {
        clearTimeout(searchCompleteRef.current)
      }
    }
  }, [])

  // Update the user interaction handler
  useEffect(() => {
    const handleUserInteraction = (e: MouseEvent | KeyboardEvent | WheelEvent) => {
      if (isSearching || isSearchNavigation) {
        const chatArea = document.querySelector('.messages-container')
        const searchArea = document.querySelector('.search-area')
        
        // Don't clear if interaction is within search area
        if (searchArea?.contains(e.target as Node)) {
          return
        }

        // Only clear search states if interaction is within chat area
        if (chatArea?.contains(e.target as Node)) {
          setIsSearching(false)
          setHighlightedMessageId(null)
          setIsSearchNavigation(false)
          // Don't reset preventAutoScroll here
        }
      }
    }

    window.addEventListener('click', handleUserInteraction)
    window.addEventListener('keydown', handleUserInteraction)
    window.addEventListener('wheel', handleUserInteraction)

    return () => {
      window.removeEventListener('click', handleUserInteraction)
      window.removeEventListener('keydown', handleUserInteraction)
      window.removeEventListener('wheel', handleUserInteraction)
    }
  }, [isSearching, isSearchNavigation])

  // Update the search navigation reset effect
  useEffect(() => {
    if (!isSearching && isSearchNavigation) {
    }
  }, [isSearching])

  // Add effect to handle navigation source changes
  useEffect(() => {
  }, [navigationSource, isSearching, isSearchNavigation])

  // Update the context change effect
  useEffect(() => {
    const contextId = currentChannel?.id || currentConversation?.id
    if (contextId) {
      if (navigationSource === 'sidebar') {
        setIsSearching(false)
        setIsSearchNavigation(false)
        setHighlightedMessageId(null)
        preventAutoScroll.current = false
      }
    }
  }, [currentChannel?.id, currentConversation?.id, navigationSource])

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
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              const form = e.currentTarget.form
              if (form) {
                // Find and click the submit button
                const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement
                if (submitButton && !submitButton.disabled) {
                  submitButton.click()
                }
              }
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