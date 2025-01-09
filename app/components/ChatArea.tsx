'use client'

import { Hash, MessageSquare, Search } from 'lucide-react'
import type { Channel, Message, Conversation, DirectMessage } from '@/app/types/models'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import UserAvatar from './UserAvatar'
import SearchMessages from './SearchMessages'
import ThreadSidebar from './ThreadSidebar'
import { useState, useEffect, useRef } from 'react'

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
  initialLoadPromise
}: ChatAreaProps) {
  const [parentMessage, setParentMessage] = useState<Message | null>(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | number | null>(null)
  const [contextSwitchSource, setContextSwitchSource] = useState<'search' | 'navigation'>('navigation')
  const searchModeRef = useRef(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchCompleteRef = useRef<NodeJS.Timeout | null>(null)
  const messagesRef = useRef<(Message | DirectMessage)[]>([])

  // Keep messagesRef in sync
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Close thread when channel or conversation changes
  useEffect(() => {
    setParentMessage(null)
    setHighlightedMessageId(null) // Reset highlighted message when changing channels
  }, [currentChannel?.id, currentConversation?.id])

  const handleMessageSelect = async (messageId: string | number, context: {
    type: 'channel' | 'conversation'
    id: string | number
  }) => {
    if (searchCompleteRef.current) {
      clearTimeout(searchCompleteRef.current)
    }
    
    setIsSearching(true)
    
    try {
      // Switch context if needed
      if (context.type === 'channel' && (!currentChannel || currentChannel.id !== context.id)) {
        const result = await onChannelSelect(context.id, 'search')
        if (result?.promise) {
          await result.promise
        }
      } else if (context.type === 'conversation' && (!currentConversation || currentConversation.id !== context.id)) {
        const result = await onConversationSelect(context.id, 'search')
        if (result?.promise) {
          await result.promise
        }
      }

      // Wait for initial messages to load
      let waitAttempts = 0
      while (waitAttempts < 20 && messagesRef.current.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
        waitAttempts++
      }

      // First check if message is in current batch
      let messageFound = messagesRef.current.some(m => m.id === messageId)

      // If not found and we have more messages, keep loading
      if (!messageFound && hasMore) {
        let loadAttempts = 0
        while (!messageFound && hasMore && loadAttempts < 20) {
          try {
            await loadMore()
            await new Promise(resolve => setTimeout(resolve, 300))
            
            // Check again after loading
            messageFound = messagesRef.current.some(m => m.id === messageId)
            loadAttempts++
          } catch (error) {
            console.error('Error loading more messages:', error)
            break
          }
        }
      }

      if (messageFound) {
        setHighlightedMessageId(messageId)
        
        // Clear highlight and search mode after delay
        searchCompleteRef.current = setTimeout(() => {
          setHighlightedMessageId(null)
          setIsSearching(false)
        }, 3000)
      } else {
        console.warn('Message not found after loading attempts:', messageId)
        setIsSearching(false)
        setHighlightedMessageId(null)
      }
    } catch (error) {
      console.error('Error in handleMessageSelect:', error)
      setIsSearching(false)
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
              avatarUrl={currentConversation.other_user.avatar_url}
              username={currentConversation.other_user.username}
              size="md"
            />
            <h2 className="text-lg font-medium ml-2">
              {currentConversation.other_user.username}
            </h2>
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
          isSearching={isSearching}
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