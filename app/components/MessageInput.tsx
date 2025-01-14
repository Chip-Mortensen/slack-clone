'use client'

import { useState, useRef, DragEvent } from 'react'
import { Paperclip, Send, Smile, X } from 'lucide-react'
import { useSupabase } from '../supabase-provider'
import dynamic from 'next/dynamic'
import type { EmojiClickData } from 'emoji-picker-react'

const Picker = dynamic(() => import('emoji-picker-react'), { ssr: false })

interface MessageInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (e: React.FormEvent, fileInfo?: { url: string, name: string }) => void
  placeholder?: string
  onSendComplete?: () => void
}

interface PendingFile {
  file: File;
  previewUrl?: string;
}

export default function MessageInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type a message...',
  onSendComplete
}: MessageInputProps) {
  const { supabase } = useSupabase()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isSubmittingRef = useRef(false)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      await handleFileUpload(file)
    }
  }

  const handleFileUpload = async (file: File) => {
    setPendingFile({ file })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isSubmittingRef.current) return
    if (!value.trim() && !pendingFile) return
    
    try {
      isSubmittingRef.current = true
      if (pendingFile) {
        setIsUploading(true)
        const timestamp = new Date().getTime()
        const fileName = `${timestamp}-${pendingFile.file.name}`

        const { data, error } = await supabase.storage
          .from('message-files')
          .upload(fileName, pendingFile.file)

        if (error) throw error

        const { data: { publicUrl } } = supabase.storage
          .from('message-files')
          .getPublicUrl(fileName)

        onSubmit(e, {
          url: publicUrl,
          name: pendingFile.file.name
        })
        setPendingFile(null)
      } else {
        onSubmit(e)
      }
      onSendComplete?.()
    } catch (error) {
      console.error('Error uploading file:', error)
    } finally {
      setIsUploading(false)
      isSubmittingRef.current = false
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
    <div
      className={`relative p-4 bg-gray-100 ${isDragging ? 'bg-blue-50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 border-2 border-blue-400 border-dashed rounded-lg flex items-center justify-center bg-blue-50 bg-opacity-90">
          <p className="text-blue-500">Drop file to upload</p>
        </div>
      )}
      
      <form className="space-y-2">
        {pendingFile && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md">
            <Paperclip size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600">{pendingFile.file.name}</span>
            <button
              type="button"
              onClick={() => setPendingFile(null)}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (!isSubmittingRef.current) {
                    handleSubmit(e)
                  }
                }
              }}
              placeholder={placeholder}
              rows={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{
                minHeight: '40px',
                maxHeight: '160px'
              }}
            />
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute right-2 bottom-[12px] p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
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

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                handleFileUpload(file)
              }
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            disabled={isUploading || !!pendingFile}
          >
            <Paperclip size={20} />
          </button>

          <button
            type="button"
            onClick={(e) => !isUploading && handleSubmit(e)}
            disabled={(!value.trim() && !pendingFile) || isUploading}
            className="p-2 text-blue-500 hover:text-blue-600 rounded-full hover:bg-blue-50 disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  )
} 