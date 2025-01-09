import type { Channel, Conversation, Message, DirectMessage } from './models'

export type ContextSwitchSource = 'search' | 'navigation'

export interface ChatAreaProps {
  currentChannel: Channel | null
  currentConversation: Conversation | null
  messages: (Message | DirectMessage)[]
  onSendMessage: (e: React.FormEvent, fileInfo?: { url: string, name: string }) => Promise<void>
  newMessage: string
  setNewMessage: (message: string) => void
  hasMore: boolean
  loadMore: () => void
  loading: boolean
  onChannelSelect: (channelId: string | number, source?: ContextSwitchSource) => 
    Promise<{ promise?: Promise<void> | undefined, source?: ContextSwitchSource }>
  onConversationSelect: (conversationId: string | number, source?: ContextSwitchSource) => 
    Promise<{ promise?: Promise<void> | undefined, source?: ContextSwitchSource }>
  channels: Channel[]
  conversations: Conversation[]
  initialLoadPromise?: Promise<void> | null
} 