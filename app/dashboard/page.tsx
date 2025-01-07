'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '../supabase-provider'
import type { User } from '@supabase/auth-helpers-nextjs'
import { Menu, X } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ChatArea from '../components/ChatArea'
import CreateChannelModal from '../components/CreateChannelModal'
import StartConversationModal from '../components/StartConversationModal'
import { useChannels } from '../hooks/useChannels'
import { useMessages } from '../hooks/useMessages'
import { useDirectMessages } from '../hooks/useDirectMessages'
import { useDirectMessageChat } from '../hooks/useDirectMessageChat'
import ConfirmationModal from '../components/ConfirmationModal'
import EditProfileModal from '../components/EditProfileModal'
import { usePresence } from '../hooks/usePresence'

export default function Dashboard() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [signOutLoading, setSignOutLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [isCreateChannelModalOpen, setIsCreateChannelModalOpen] = useState(false)
  const [isStartConversationModalOpen, setIsStartConversationModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'channel' | 'conversation'
    item: Channel | Conversation
  } | null>(null)
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)

  // Add usePresence here, it will only be active when user exists
  usePresence(user?.id)

  // Channel related hooks
  const {
    channels,
    currentChannel,
    setCurrentChannel,
    loading: channelsLoading,
    createChannel
  } = useChannels()

  const {
    messages: channelMessages,
    loading: channelMessagesLoading,
    sendMessage: sendChannelMessage
  } = useMessages(currentChannel?.id ?? null)

  // Direct message related hooks
  const {
    conversations,
    currentConversation,
    setCurrentConversation,
    setConversations,
    loading: conversationsLoading,
    startConversation
  } = useDirectMessages()

  const {
    messages: directMessages,
    loading: directMessagesLoading,
    sendMessage: sendDirectMessage
  } = useDirectMessageChat(currentConversation)

  // Clear the other type of chat when one is selected
  useEffect(() => {
    if (currentChannel) {
      setCurrentConversation(null)
    }
  }, [currentChannel])

  useEffect(() => {
    if (currentConversation) {
      setCurrentChannel(null)
    }
  }, [currentConversation])

  useEffect(() => {
    async function getUser() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
          throw error || new Error('No user found')
        }
        setUser(user)
      } catch (error) {
        console.error('Error:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [router, supabase])

  useEffect(() => {
    async function getProfile() {
      if (!user) return
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) throw error
        setProfile(data)
      } catch (error) {
        console.error('Error fetching profile:', error)
      }
    }

    getProfile()
  }, [user, supabase])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newMessage.trim()) return

    try {
      if (currentChannel) {
        await sendChannelMessage(newMessage, user.id)
      } else if (currentConversation) {
        await sendDirectMessage(newMessage, user.id)
      }
      
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

  const handleSignOut = async () => {
    try {
      setSignOutLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setSignOutLoading(false)
    }
  }

  const handleCreateChannel = async (channelName: string) => {
    if (!user) return
    await createChannel(channelName, user.id)
  }

  const handleStartConversation = async (userId: string) => {
    if (!user) return
    const conversation = await startConversation(userId)
    setCurrentConversation(conversation)
    setIsStartConversationModalOpen(false)
  }

  const handleDeleteChannel = async (channel: Channel) => {
    setDeleteTarget({ type: 'channel', item: channel })
  }

  const handleDeleteConversation = async (conversation: Conversation) => {
    setDeleteTarget({ type: 'conversation', item: conversation })
  }

  const handleConfirmDelete = async () => {
    console.log('handleConfirmDelete called', { deleteTarget })
    if (!deleteTarget) return

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        console.error('No user found')
        return
      }

      if (deleteTarget.type === 'channel') {
        console.log('Deleting channel:', {
          channelId: deleteTarget.item.id,
          userId: currentUser.id,
          channel: deleteTarget.item,
          isOwner: deleteTarget.item.created_by === currentUser.id
        })

        // First check if user owns the channel
        if (deleteTarget.item.created_by !== currentUser.id) {
          console.error('Cannot delete channel: User is not the owner')
          // Optionally show an error message to the user
          return
        }

        const { data, error } = await supabase
          .from('channels')
          .delete()
          .eq('id', deleteTarget.item.id)
          .select()

        console.log('Channel delete response:', { data, error })

        if (error) {
          console.error('Channel delete error:', error)
          throw error
        }

        // Update local state
        if (currentChannel?.id === deleteTarget.item.id) {
          setCurrentChannel(null)
        }
      } else {
        console.log('Deleting conversation:', {
          conversationId: deleteTarget.item.id,
          userId: currentUser.id,
          conversation: deleteTarget.item
        })

        // Use OR condition for user IDs
        const { data, error } = await supabase
          .from('conversations')
          .delete()
          .eq('id', deleteTarget.item.id)
          .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
          .select()

        console.log('Conversation delete response:', { data, error })

        if (error) {
          console.error('Conversation delete error:', error)
          throw error
        }

        // Update local state
        if (currentConversation?.id === deleteTarget.item.id) {
          setCurrentConversation(null)
        }

        // Manually update conversations list
        setConversations(prev => 
          prev.filter(conv => conv.id !== deleteTarget.item.id)
        )
      }
      setDeleteTarget(null)
    } catch (error) {
      console.error('Error in handleConfirmDelete:', error)
    }
  }

  const handleProfileUpdate = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching updated profile:', error)
      return
    }

    setProfile(data)
  }

  if (loading || channelsLoading || conversationsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) return null

  const currentMessages = currentChannel ? channelMessages : directMessages

  return (
    <div className="flex h-screen">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800 text-white rounded-md"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <Sidebar
        user={user}
        channels={channels}
        currentChannel={currentChannel}
        onChannelSelect={setCurrentChannel}
        onCreateChannel={() => setIsCreateChannelModalOpen(true)}
        onSignOut={handleSignOut}
        signOutLoading={signOutLoading}
        sidebarOpen={sidebarOpen}
        conversations={conversations || []}
        currentConversation={currentConversation}
        onConversationSelect={setCurrentConversation}
        onStartConversation={() => setIsStartConversationModalOpen(true)}
        onDeleteChannel={handleDeleteChannel}
        onDeleteConversation={handleDeleteConversation}
        profile={profile}
        onEditProfile={() => setIsEditProfileModalOpen(true)}
      />

      <ChatArea
        currentChannel={currentChannel}
        currentConversation={currentConversation}
        messages={currentMessages}
        onSendMessage={handleSendMessage}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        handleKeyPress={handleKeyPress}
      />

      <CreateChannelModal
        isOpen={isCreateChannelModalOpen}
        onClose={() => setIsCreateChannelModalOpen(false)}
        onSubmit={handleCreateChannel}
      />

      <StartConversationModal
        isOpen={isStartConversationModalOpen}
        onClose={() => setIsStartConversationModalOpen(false)}
        onSubmit={handleStartConversation}
      />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${deleteTarget?.type === 'channel' ? 'Channel' : 'Conversation'}`}
        message={`Are you sure you want to delete this ${
          deleteTarget?.type === 'channel' ? 'channel' : 'conversation'
        }? This action cannot be undone.`}
      />

      {profile && (
        <EditProfileModal
          isOpen={isEditProfileModalOpen}
          onClose={() => setIsEditProfileModalOpen(false)}
          profile={profile}
          onUpdate={handleProfileUpdate}
        />
      )}
    </div>
  )
} 