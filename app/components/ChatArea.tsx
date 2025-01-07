'use client'

import { Hash, MessageSquare } from 'lucide-react'
import type { Channel, Message, Conversation, DirectMessage } from '@/app/types'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

interface ChatAreaProps {
  currentChannel: Channel | null
  currentConversation: Conversation | null
  messages: (Message | DirectMessage)[]
  onSendMessage: (e: React.FormEvent) => Promise<void>
  newMessage: string
  setNewMessage: (message: string) => void
  handleKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export default function ChatArea({
  currentChannel,
  currentConversation,
  messages,
  onSendMessage,
  newMessage,
  setNewMessage,
  handleKeyPress
}: ChatAreaProps) {
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
            {currentConversation.other_user.avatar_url && (
              <img
                src={currentConversation.other_user.avatar_url}
                alt=""
                className="w-8 h-8 rounded-lg mr-2"
              />
            )}
            <h2 className="text-lg font-medium">
              {currentConversation.other_user.username}
            </h2>
          </div>
        </>
      )
    }
    return <h2 className="text-lg font-medium">Select a channel or conversation</h2>
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-gray-200 bg-white">
        <div className="flex items-center">
          {getHeaderContent()}
        </div>
      </div>

      <MessageList messages={messages} />

      <MessageInput
        onSubmit={onSendMessage}
        value={newMessage}
        onChange={setNewMessage}
        onKeyPress={handleKeyPress}
      />
    </div>
  )
} 