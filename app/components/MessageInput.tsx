'use client'

import { useState, useRef } from 'react'
import { Paperclip, Smile } from 'lucide-react'
import { useSupabase } from '../supabase-provider'
import dynamic from 'next/dynamic'
import type { EmojiClickData } from 'emoji-picker-react'

const Picker = dynamic(() => import('emoji-picker-react'), { ssr: false })

interface MessageInputProps {
  onSubmit: (e: React.FormEvent, fileInfo?: { url: string, name: string }) => Promise<void>
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
  const { supabase } = useSupabase()
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (uploading) return
    if (!value.trim() && !selectedFile) return

    try {
      setUploading(true)
      let fileInfo: { url: string, name: string } | undefined = undefined

      // Handle file upload first if there's a selected file
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('message-files')
          .upload(filePath, selectedFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('message-files')
          .getPublicUrl(filePath)

        fileInfo = {
          url: publicUrl,
          name: selectedFile.name
        }
      }

      // Submit message with file info
      await onSubmit(e, fileInfo)
      
      // Clear file selection and input only after successful submission
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleEmojiSelect = (emojiData: EmojiClickData) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = value.slice(0, start) + emojiData.emoji + value.slice(end)
    
    onChange(newValue)
    
    // Set cursor position after the inserted emoji
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emojiData.emoji.length
      textarea.focus()
    }, 0)

    setShowEmojiPicker(false)
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white border-t">
      <div className="flex items-end space-x-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyPress}
            placeholder="Type a message..."
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={1}
          />
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="absolute right-2 bottom-2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <Smile size={20} />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-full right-0 mb-2">
              <div className="bg-white rounded-lg shadow-lg">
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
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`p-2 text-gray-500 hover:text-gray-700 ${selectedFile ? 'text-blue-500' : ''}`}
          disabled={uploading}
          title={selectedFile ? selectedFile.name : 'Attach file'}
        >
          <Paperclip size={20} />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          type="submit"
          disabled={(!value.trim() && !selectedFile) || uploading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Send'}
        </button>
      </div>
      {selectedFile && (
        <div className="mt-2 text-sm text-gray-600">
          Selected file: {selectedFile.name}
        </div>
      )}
    </form>
  )
} 