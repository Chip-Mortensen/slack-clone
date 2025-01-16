'use client'

import { Hash, LogOut, User as UserIcon, Plus, MessageSquare, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Channel, Conversation, Profile } from '@/app/types'
import type { User } from '@supabase/auth-helpers-nextjs'
import UserAvatar from './UserAvatar'
import { useName } from '../contexts/NameContext'
import { useState } from 'react'

interface SidebarProps {
  user: User
  channels: Channel[]
  currentChannel: Channel | null
  onChannelSelect: (channelId: string | number, source?: 'search' | 'navigation') => void
  onCreateChannel: () => void
  onSignOut: () => Promise<void>
  signOutLoading: boolean
  sidebarOpen: boolean
  conversations: Conversation[]
  currentConversation: Conversation | null
  onConversationSelect: (conversationId: string | number, source?: 'search' | 'navigation') => void
  onStartConversation: () => void
  onDeleteChannel: (channel: Channel) => Promise<void>
  onDeleteConversation: (conversation: Conversation) => Promise<void>
  profile: Profile | null
  onEditProfile: () => void
  onlineUsers?: string[]
  onUpdate: () => Promise<void>
}

export default function Sidebar({
  user,
  channels,
  currentChannel,
  onChannelSelect,
  onCreateChannel,
  onSignOut,
  signOutLoading,
  sidebarOpen,
  conversations,
  currentConversation,
  onConversationSelect,
  onStartConversation,
  onDeleteChannel,
  onDeleteConversation,
  profile,
  onEditProfile,
  onlineUsers = [],
  onUpdate
}: SidebarProps) {
  const router = useRouter()
  const { getUsername } = useName()

  const handleChannelClick = (channelId: string | number) => {
    onChannelSelect(channelId, 'navigation')
  }

  const handleConversationClick = (conversationId: string | number) => {
    onConversationSelect(conversationId, 'navigation')
  }

  return (
    <div className={`
      fixed lg:static inset-y-0 left-0 z-40
      w-64 bg-white text-gray-900 transform transition-transform duration-200 ease-in-out border-r border-gray-200
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      lg:translate-x-0
    `}>
      <div className="flex flex-col h-full">
        {/* Workspace Header */}
        <div className="p-4 border-b h-16 border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 text-blue-600">
              <svg
                className="w-full h-full"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-blue-600">Slacker</h1>
          </div>
        </div>

        {/* Channels Section */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                Channels
              </h2>
              <button 
                onClick={onCreateChannel}
                className="text-gray-500 hover:text-blue-600 transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>
            
            {/* Channel List */}
            <div className="space-y-0.5">
              {channels.map(channel => (
                <div
                  key={channel.id}
                  className={`
                    group flex items-center justify-between hover:bg-white rounded-md
                    ${currentChannel?.id === channel.id ? 'bg-white shadow-sm ring-1 ring-gray-200' : ''}
                  `}
                >
                  <button
                    onClick={() => handleChannelClick(channel.id)}
                    className="flex items-center flex-1 px-2 py-1.5"
                  >
                    <Hash size={18} className={`mr-2 ${currentChannel?.id === channel.id ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`${currentChannel?.id === channel.id ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                      {channel.name}
                    </span>
                  </button>
                  {channel.created_by === user.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteChannel(channel)
                      }}
                      className="invisible group-hover:visible px-2 py-1.5 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Direct Messages Section */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Direct Messages
            </h2>
            <button 
              onClick={onStartConversation}
              className="text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>
          
          {/* Conversations List */}
          <div className="space-y-0.5">
            {conversations.map(conversation => (
              <div
                key={conversation.id}
                className={`
                  group flex items-center justify-between hover:bg-white rounded-md
                  ${currentConversation?.id === conversation.id ? 'bg-white shadow-sm ring-1 ring-gray-200' : ''}
                `}
              >
                <button
                  onClick={() => handleConversationClick(conversation.id)}
                  className="flex items-center flex-1 px-2 py-1.5"
                >
                  <div className="flex items-center">
                    <UserAvatar
                      userId={conversation.other_user.id}
                      showStatus={true}
                      online={onlineUsers.includes(String(conversation.other_user.id))}
                    />
                    <span className={`ml-2 ${currentConversation?.id === conversation.id ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                      {getUsername(conversation.other_user.id.toString()) || 'Unknown User'}
                    </span>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteConversation(conversation)
                  }}
                  className="invisible group-hover:visible px-2 py-1.5 text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <button
            onClick={onEditProfile}
            className="w-full flex items-center p-2 hover:bg-gray-50 rounded-md transition-colors"
          >
            <div className="flex items-center flex-1 min-w-0">
              <UserAvatar
                userId={user.id}
                size="md"
                showStatus={true}
                online={onlineUsers.includes(String(user.id))}
              />
              <div className="ml-2 text-left flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {profile?.username || 'Loading...'}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {user.email}
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={onSignOut}
            disabled={signOutLoading}
            className="flex items-center w-full px-2 py-1.5 mt-2 text-gray-600 hover:bg-gray-50 rounded-md disabled:opacity-50 transition-colors"
          >
            <LogOut size={18} className="mr-2" />
            {signOutLoading ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  )
} 