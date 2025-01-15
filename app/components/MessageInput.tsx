'use client'

import { useState, useRef, DragEvent, useEffect } from 'react'
import { Paperclip, Send, Smile, X } from 'lucide-react'
import { useSupabase } from '../supabase-provider'
import dynamic from 'next/dynamic'
import type { EmojiClickData } from 'emoji-picker-react'
import type { Profile } from '@/app/types/models'
import { formatMention } from '../utils/tokenizer'
import MentionSuggestions from './MentionSuggestions'

// Type for profile suggestions (subset of Profile)
type ProfileSuggestion = Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'>

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
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionSuggestions, setMentionSuggestions] = useState<ProfileSuggestion[]>([])
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const [mentionInputRect, setMentionInputRect] = useState<DOMRect | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLDivElement>(null)
  const isSubmittingRef = useRef(false)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  // Handle mention suggestions
  const handleInput = async (e: React.FormEvent<HTMLDivElement>) => {
    setIsEmpty(!e.currentTarget.textContent?.trim())
    // Get the text content and convert any styled mentions back to tokens
    const content = Array.from(e.currentTarget.childNodes).map(node => {
      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).hasAttribute('data-mention')) {
        const username = (node as Element).getAttribute('data-mention')
        return `@[${username}]`
      }
      return node.textContent
    }).join('')

    onChange(content)

    // Check for @ symbol
    const selection = window.getSelection()
    if (!selection) return
    
    const range = selection.getRangeAt(0)
    const textContent = e.currentTarget.textContent || ''
    const cursorPosition = getCursorOffset(e.currentTarget, range)
    const textBeforeCursor = textContent.slice(0, cursorPosition)
    const atSymbolIndex = textBeforeCursor.lastIndexOf('@')
    
    if (atSymbolIndex !== -1 && (atSymbolIndex === 0 || textBeforeCursor[atSymbolIndex - 1] === ' ')) {
      const query = textBeforeCursor.slice(atSymbolIndex + 1)
      setMentionQuery(query)
      
      // Get input position for dropdown
      if (textareaRef.current) {
        const inputRect = textareaRef.current.getBoundingClientRect()
        const tempRange = document.createRange()
        tempRange.setStart(e.currentTarget.firstChild || e.currentTarget, atSymbolIndex)
        const rangeRect = tempRange.getBoundingClientRect()
        
        const rect = {
          bottom: rangeRect.bottom + 5,
          left: rangeRect.left,
          right: inputRect.right,
          top: rangeRect.top
        }
        setMentionInputRect(rect as DOMRect)
      }
      
      // Fetch user suggestions
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .ilike('username', `${query}%`)
        .limit(5)
      
      setMentionSuggestions(profiles || [])
      setShowMentions(true)
      setSelectedMentionIndex(0)
    } else {
      setShowMentions(false)
    }
  }

  const handleMentionSelect = (profile: ProfileSuggestion) => {
    const selection = window.getSelection()
    if (!selection || !textareaRef.current) return
    
    const range = selection.getRangeAt(0)
    const text = textareaRef.current.textContent || ''
    const cursorPosition = range.startOffset
    const textBeforeCursor = text.slice(0, cursorPosition)
    const atSymbolIndex = textBeforeCursor.lastIndexOf('@')
    
    if (atSymbolIndex !== -1) {
      // Create token format for storage
      const mention = `@[${profile.username}]`
      const newText = 
        text.slice(0, atSymbolIndex) + 
        mention +
        text.slice(cursorPosition)
      
      // Create mention span for display only
      const mentionSpan = document.createElement('span')
      mentionSpan.contentEditable = 'false'
      mentionSpan.className = 'bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mx-0.5 cursor-pointer'
      mentionSpan.textContent = `@${profile.username}`
      mentionSpan.setAttribute('data-mention', profile.username)
      
      // Split text and create nodes
      const beforeText = document.createTextNode(text.slice(0, atSymbolIndex))
      const afterText = document.createTextNode(text.slice(cursorPosition))
      
      // Clear and update content
      textareaRef.current.textContent = ''
      textareaRef.current.appendChild(beforeText)
      textareaRef.current.appendChild(mentionSpan)
      textareaRef.current.appendChild(afterText)
      
      // Set cursor after mention
      const newRange = document.createRange()
      newRange.setStartAfter(mentionSpan)
      newRange.setEndAfter(mentionSpan)
      selection.removeAllRanges()
      selection.addRange(newRange)
      
      // Update parent with token format
      onChange(newText)
      setShowMentions(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMentionIndex(i => 
          i < mentionSuggestions.length - 1 ? i + 1 : 0
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMentionIndex(i => 
          i > 0 ? i - 1 : mentionSuggestions.length - 1
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleMentionSelect(mentionSuggestions[selectedMentionIndex])
      } else if (e.key === 'Escape') {
        setShowMentions(false)
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isSubmittingRef.current) {
        handleSubmit(e)
      }
    } else if (e.key === 'Backspace') {
      const selection = window.getSelection()
      if (!selection || !textareaRef.current) return
      
      const range = selection.getRangeAt(0)
      const text = textareaRef.current.textContent || ''
      const cursorPosition = range.startOffset
      const textBeforeCursor = text.slice(0, cursorPosition)
      const matches = textBeforeCursor.match(/@\[[^\]]+\]$/)
      
      if (matches) {
        e.preventDefault()
        const tokenStart = textBeforeCursor.lastIndexOf(matches[0])
        const newText = text.slice(0, tokenStart) + text.slice(cursorPosition)
        
        // Update content
        textareaRef.current.textContent = newText
        
        // Set cursor position to where the token started
        const newRange = document.createRange()
        newRange.setStart(textareaRef.current.firstChild || textareaRef.current, tokenStart)
        newRange.setEnd(textareaRef.current.firstChild || textareaRef.current, tokenStart)
        selection.removeAllRanges()
        selection.addRange(newRange)
        
        onChange(newText)
      }
    }
  }

  const handleEmojiSelect = (emojiData: EmojiClickData) => {
    if (!textareaRef.current) return
    
    const selection = window.getSelection()
    if (!selection) return
    
    const range = selection.getRangeAt(0)
    const text = textareaRef.current.textContent || ''
    const start = range.startOffset
    const newText = text.slice(0, start) + emojiData.emoji + text.slice(range.endOffset)
    
    // Update content
    textareaRef.current.textContent = newText
    
    // Set cursor position after emoji
    const newPosition = start + emojiData.emoji.length
    const newRange = document.createRange()
    newRange.setStart(textareaRef.current.firstChild || textareaRef.current, newPosition)
    newRange.setEnd(textareaRef.current.firstChild || textareaRef.current, newPosition)
    selection.removeAllRanges()
    selection.addRange(newRange)
    
    onChange(newText)
    setShowEmojiPicker(false)
  }

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
      
      // Clear both the contentEditable div and parent's value
      if (textareaRef.current) {
        textareaRef.current.textContent = ''
        setIsEmpty(true)
      }
      onChange('')
      onSendComplete?.()
    } catch (error) {
      console.error('Error uploading file:', error)
    } finally {
      setIsUploading(false)
      isSubmittingRef.current = false
    }
  }

  const getCaretLeft = () => {
    if (!textareaRef.current) return 0;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return 0;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(textareaRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    
    const rects = preCaretRange.getClientRects();
    if (rects.length === 0) return 12; // Default padding
    return rects[rects.length - 1].left - textareaRef.current.getBoundingClientRect().left;
  };

  const getCaretTop = () => {
    if (!textareaRef.current) return 0;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return 0;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(textareaRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    
    const rects = preCaretRange.getClientRects();
    if (rects.length === 0) return 8; // Default padding
    return rects[rects.length - 1].top - textareaRef.current.getBoundingClientRect().top;
  };

  const handleFocus = (e: React.FocusEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    setIsFocused(true)
    
    if (!textareaRef.current) return
    textareaRef.current.focus()
    
    // If it's a click event, calculate cursor position based on click coordinates
    if ('clientX' in e) {
      const range = document.caretRangeFromPoint(e.clientX, e.clientY)
      if (range) {
        const selection = window.getSelection()
        if (selection) {
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
    } else {
      // For regular focus events, move cursor to end
      const selection = window.getSelection()
      if (selection && textareaRef.current.lastChild) {
        const range = document.createRange()
        range.selectNodeContents(textareaRef.current)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
  }

  // Helper to get cursor offset in text content
  const getCursorOffset = (element: Node, range: Range) => {
    const preRange = range.cloneRange()
    preRange.selectNodeContents(element)
    preRange.setEnd(range.endContainer, range.endOffset)
    return preRange.toString().length
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
            <div className="relative">
              <div
                ref={textareaRef}
                contentEditable
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onClick={handleFocus}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-pre-wrap bg-white relative ${!isEmpty ? 'before:hidden' : 'before:block'} before:content-[attr(data-placeholder)] before:text-gray-400 before:absolute before:top-2 before:left-3 before:pointer-events-none`}
                data-placeholder={placeholder}
                style={{
                  minHeight: '40px',
                  maxHeight: '160px'
                }}
              />
            </div>
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
            <MentionSuggestions
              query={mentionQuery}
              suggestions={mentionSuggestions}
              onSelect={handleMentionSelect}
              selectedIndex={selectedMentionIndex}
              visible={showMentions}
              inputRect={mentionInputRect}
            />
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