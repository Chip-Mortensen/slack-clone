'use client'

import { useState, useRef, useEffect } from 'react'
import { Smile } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { EmojiClickData } from 'emoji-picker-react'

const Picker = dynamic(() => import('emoji-picker-react'), { ssr: false })

interface Reaction {
  id: string | number
  emoji: string
  user_id: string
}

interface MessageReactionsProps {
  messageId: string | number
  isDirectMessage: boolean
  reactions: Reaction[]
  currentUserId: string
  onAddReaction: (emoji: string) => Promise<void>
  onRemoveReaction: (reactionId: string | number) => Promise<void>
}

export default function MessageReactions({
  messageId,
  isDirectMessage,
  reactions,
  currentUserId,
  onAddReaction,
  onRemoveReaction
}: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        count: 0,
        userReactionId: null,
        reactions: []
      }
    }
    acc[reaction.emoji].count++
    acc[reaction.emoji].reactions.push(reaction)
    if (reaction.user_id === currentUserId) {
      acc[reaction.emoji].userReactionId = reaction.id
    }
    return acc
  }, {} as Record<string, { count: number; userReactionId: string | number | null; reactions: Reaction[] }>)

  const handleEmojiSelect = async (emojiData: EmojiClickData) => {
    console.log('Emoji selected:', emojiData)
    setShowPicker(false)

    // Find if user already has a reaction on this message
    const existingReaction = Object.values(groupedReactions).find(group => 
      group.reactions.some(r => r.user_id === currentUserId)
    )?.reactions.find(r => r.user_id === currentUserId)

    if (existingReaction) {
      // If user is selecting the same emoji, just remove it
      if (existingReaction.emoji === emojiData.emoji) {
        await onRemoveReaction(existingReaction.id)
        return
      }
      
      // Remove the old reaction before adding the new one
      await onRemoveReaction(existingReaction.id)
    }

    // Add the new reaction
    await onAddReaction(emojiData.emoji)
  }

  console.log('Picker state:', { showPicker, messageId, reactions })

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-2 mt-2">
      {Object.entries(groupedReactions).map(([emoji, data]) => (
        <button
          key={emoji}
          onClick={async () => {
            if (data.userReactionId) {
              await onRemoveReaction(data.userReactionId)
            } else {
              // Find if user already has a reaction on this message
              const existingReaction = Object.values(groupedReactions).find(group => 
                group.reactions.some(r => r.user_id === currentUserId)
              )?.reactions.find(r => r.user_id === currentUserId)

              if (existingReaction) {
                // Remove the old reaction before adding the new one
                await onRemoveReaction(existingReaction.id)
              }
              await onAddReaction(emoji)
            }
          }}
          className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm
            transition-colors duration-150
            ${data.userReactionId 
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }
          `}
        >
          <span>{emoji}</span>
          <span className="text-xs">{data.count}</span>
        </button>
      ))}
      
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation()
            setShowPicker(!showPicker)
          }}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
        >
          <Smile size={16} />
        </button>

        {showPicker && (
          <div 
            className="fixed z-50"
            style={{
              top: buttonRef.current 
                ? buttonRef.current.getBoundingClientRect().bottom + 8 
                : 0,
              left: buttonRef.current 
                ? buttonRef.current.getBoundingClientRect().left 
                : 0,
            }}
          >
            <div 
              className="bg-white rounded-lg shadow-lg"
              onClick={e => e.stopPropagation()}
            >
              <Picker 
                onEmojiClick={handleEmojiSelect}
                width={300}
                height={400}
                lazyLoadEmojis={true}
                searchDisabled={false}
                skinTonesDisabled={true}
                previewConfig={{
                  showPreview: false
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 