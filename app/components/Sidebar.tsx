'use client'

import { Hash, LogOut, User as UserIcon, Plus, MessageSquare, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Channel, Conversation, Profile } from '@/app/types'
import type { User } from '@supabase/auth-helpers-nextjs'

interface SidebarProps {
  user: User
  channels: Channel[]
  currentChannel: Channel | null
  onChannelSelect: (channel: Channel) => void
  onCreateChannel: () => void
  onSignOut: () => Promise<void>
  signOutLoading: boolean
  sidebarOpen: boolean
  conversations: Conversation[]
  currentConversation: Conversation | null
  onConversationSelect: (conversation: Conversation) => void
  onStartConversation: () => void
  onDeleteChannel: (channel: Channel) => Promise<void>
  onDeleteConversation: (conversation: Conversation) => Promise<void>
  profile: Profile | null
  onEditProfile: () => void
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
  onEditProfile
}: SidebarProps) {
  const router = useRouter()

  return (
    <div className={`
      fixed lg:static inset-y-0 left-0 z-40
      w-64 bg-gray-900 text-white transform transition-transform duration-200 ease-in-out
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      lg:translate-x-0
    `}>
      <div className="flex flex-col h-full">
        {/* Workspace Header */}
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-bold">Workspace</h1>
          <p className="text-sm text-gray-400">{user.email}</p>
        </div>

        {/* Channels Section */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                Channels
              </h2>
              <button 
                onClick={onCreateChannel}
                className="text-gray-400 hover:text-white"
              >
                <Plus size={20} />
              </button>
            </div>
            
            {/* Channel List */}
            <div className="space-y-1">
              {channels.map(channel => (
                <div
                  key={channel.id}
                  className={`
                    group flex items-center justify-between hover:bg-gray-800 rounded
                    ${currentChannel?.id === channel.id ? 'bg-gray-800' : ''}
                  `}
                >
                  <button
                    onClick={() => onChannelSelect(channel)}
                    className="flex items-center flex-1 px-2 py-1 text-gray-300"
                  >
                    <Hash size={18} className="mr-2" />
                    {channel.name}
                  </button>
                  {channel.created_by === user.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteChannel(channel)
                      }}
                      className="invisible group-hover:visible px-2 py-1 text-gray-400 hover:text-red-500"
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
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Direct Messages
            </h2>
            <button 
              onClick={onStartConversation}
              className="text-gray-400 hover:text-white"
            >
              <Plus size={20} />
            </button>
          </div>
          
          {/* Conversations List */}
          <div className="space-y-1">
            {conversations.map(conversation => (
              <div
                key={conversation.id}
                className={`
                  group flex items-center justify-between hover:bg-gray-800 rounded
                  ${currentConversation?.id === conversation.id ? 'bg-gray-800' : ''}
                `}
              >
                <button
                  onClick={() => onConversationSelect(conversation)}
                  className="flex items-center flex-1 px-2 py-1 text-gray-300"
                >
                  <MessageSquare size={18} className="mr-2" />
                  <div className="flex items-center">
                    {conversation.other_user.avatar_url && (
                      <img
                        src={conversation.other_user.avatar_url}
                        alt=""
                        className="w-6 h-6 rounded-lg mr-2 object-cover"
                      />
                    )}
                    <span>{conversation.other_user.username}</span>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteConversation(conversation)
                  }}
                  className="invisible group-hover:visible px-2 py-1 text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-gray-800 space-y-2">
          <button
            onClick={onEditProfile}
            className="flex items-center w-full px-2 py-1 text-gray-300 hover:bg-gray-800 rounded"
          >
            <UserIcon size={18} className="mr-2" />
            Edit Profile
          </button>
          <button
            onClick={onSignOut}
            disabled={signOutLoading}
            className="flex items-center w-full px-2 py-1 text-gray-300 hover:bg-gray-800 rounded disabled:opacity-50"
          >
            <LogOut size={18} className="mr-2" />
            {signOutLoading ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  )
} 