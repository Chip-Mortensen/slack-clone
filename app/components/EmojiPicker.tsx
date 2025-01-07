'use client'

import { useState, useRef, useEffect } from 'react'
import { Smile } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { EmojiClickData } from 'emoji-picker-react'

// Dynamically import the emoji picker to avoid SSR issues
const Picker = dynamic(() => import('emoji-picker-react'), { ssr: false })

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
}

export default function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
        type="button"
      >
        <Smile size={20} />
      </button>

      {isOpen && (
        <div 
          className="fixed z-50"
          style={{
            bottom: '80px', // Adjust based on your input height
            right: '20px',
          }}
        >
          <div className="bg-white rounded-lg shadow-lg">
            <Picker 
              onEmojiClick={handleEmojiClick}
              width={350}
              height={400}
            />
          </div>
        </div>
      )}
    </div>
  )
} 