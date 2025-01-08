'use client'

import { Hash, MessageSquare, Search } from 'lucide-react'
import type { Channel, Message, Conversation, DirectMessage } from '@/app/types'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import UserAvatar from './UserAvatar'
import SearchMessages from './SearchMessages'
import ThreadSidebar from './ThreadSidebar'
import { useState, useEffect } from 'react'

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
  loading
}: ChatAreaProps) {
  const [parentMessage, setParentMessage] = useState<Message | null>(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | number | null>(null)

  // Close thread when channel or conversation changes
  useEffect(() => {
    setParentMessage(null)
    setHighlightedMessageId(null) // Reset highlighted message when changing channels
  }, [currentChannel?.id, currentConversation?.id])

  const handleMessageSelect = async (messageId: string | number) => {
    // First ensure we have loaded enough messages
    const messageExists = messages.some(m => m.id === messageId)
    
    if (!messageExists && hasMore && !loading) {
      try {
        // Load one batch of messages
        await loadMore()
        // Wait a bit for the messages to render
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (error) {
        console.error('Error loading more messages:', error)
      }
    }

    // Set the highlighted message ID which will trigger the scroll
    setHighlightedMessageId(messageId)
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