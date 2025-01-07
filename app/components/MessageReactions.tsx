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
  const [pickerPosition, setPickerPosition] = useState<'top' | 'bottom'>('bottom')
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Calculate picker position
  useEffect(() => {
    if (showPicker && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      
      // If there's less than 400px below, show picker on top
      setPickerPosition(spaceBelow < 400 ? 'top' : 'bottom')
    }
  }, [showPicker])

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
    setShowPicker(false)
    
    // Check if user already has any reaction on this message
    const existingReaction = reactions.find(r => r.user_id === currentUserId)
    if (existingReaction) {
      // Remove existing reaction before adding new one
      await onRemoveReaction(existingReaction.id)
    }
    
    await onAddReaction(emojiData.emoji)
  }

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-2 mt-1">
      {Object.entries(groupedReactions).map(([emoji, data]) => (
        <button
          key={emoji}
          onClick={async () => {
            if (data.userReactionId) {
              await onRemoveReaction(data.userReactionId)
            } else {
              // Remove any existing reaction from this user before adding new one
              const existingReaction = reactions.find(r => r.user_id === currentUserId)
              if (existingReaction) {
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
              top: buttonRef.current && pickerPosition === 'bottom'
                ? buttonRef.current.getBoundingClientRect().bottom + 8 
                : buttonRef.current
                  ? buttonRef.current.getBoundingClientRect().top - 408 // 400px height + 8px margin
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