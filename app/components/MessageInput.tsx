'use client'

import { useRef } from 'react'
import EmojiPicker from './EmojiPicker'

interface MessageInputProps {
  onSubmit: (e: React.FormEvent) => Promise<void>
  value: string
  onChange: (value: string) => void
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export default function MessageInput({
  onSubmit,
  value,
  onChange,
  onKeyPress
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = value.slice(0, start) + emoji + value.slice(end)
    
    onChange(newValue)
    
    // Set cursor position after the inserted emoji
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length
      textarea.focus()
    }, 0)
  }

  return (
    <form onSubmit={onSubmit} className="p-4 bg-white border-t border-gray-200">
      <div className="flex items-start space-x-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder="Type a message..."
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <div className="absolute bottom-2 right-2">
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />
          </div>
        </div>
        <button
          type="submit"
          className="px-4 py-2 h-[42px] bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 flex-shrink-0"
          disabled={!value.trim()}
        >
          Send
        </button>
      </div>
    </form>
  )
} 