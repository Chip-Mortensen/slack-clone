'use client'

import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'
import type { SearchToken, SearchSuggestion } from '@/app/types/search'
import type { Channel, Conversation } from '@/app/types'
import { useDebounce } from '@/app/hooks/useDebounce'

interface SearchInputProps {
  channels: Channel[]
  conversations: Conversation[]
  currentContext?: { type: 'channel' | 'conversation', id: string | number }
  onSearch: (tokens: SearchToken[]) => void
}

export default function SearchInput({ channels, conversations, currentContext, onSearch }: SearchInputProps) {
  const [tokens, setTokens] = useState<SearchToken[]>([])
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionType, setSuggestionType] = useState<'channel' | 'user' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const hasManuallyRemovedContext = useRef(false)

  // Initialize with current context if any, but only when context changes
  useEffect(() => {
    if (currentContext && !hasManuallyRemovedContext.current) {
      const contextToken = currentContext.type === 'channel'
        ? {
            type: 'channel',
            id: currentContext.id,
            value: channels.find(c => c.id === currentContext.id)?.name || '',
            displayValue: channels.find(c => c.id === currentContext.id)?.name || ''
          }
        : {
            type: 'user',
            id: currentContext.id,
            value: conversations.find(c => c.id === currentContext.id)?.other_user.username || '',
            displayValue: conversations.find(c => c.id === currentContext.id)?.other_user.username || ''
          }
      
      setTokens(currentTokens => {
        const currentContextToken = currentTokens.find(t => t.type === 'channel' || t.type === 'user')
        if (!currentTokens.length || (currentContextToken && currentContextToken.id !== contextToken.id)) {
          return [contextToken]
        }
        return currentTokens
      })
    }
  }, [currentContext, channels, conversations])

  // Get suggestions based on current input
  const getSuggestions = (): SearchSuggestion[] => {
    if (!suggestionType || !inputValue) return []

    const searchTerm = inputValue.slice(1).toLowerCase()
    console.log('Getting suggestions for:', { suggestionType, searchTerm })
    
    if (suggestionType === 'channel') {
      const channelSuggestions = channels
        .filter(channel => 
          channel.name.toLowerCase().includes(searchTerm)
        )
        .map(channel => ({
          type: 'channel',
          id: channel.id,
          displayValue: channel.name,
          searchValue: channel.name.toLowerCase()
        }))
      console.log('Channel suggestions:', channelSuggestions)
      return channelSuggestions
    } else {
      const userSuggestions = conversations
        .filter(conv => 
          conv.other_user.username.toLowerCase().includes(searchTerm)
        )
        .map(conv => ({
          type: 'user',
          id: conv.id,
          displayValue: conv.other_user.username,
          searchValue: conv.other_user.username.toLowerCase()
        }))
      console.log('User suggestions:', userSuggestions)
      return userSuggestions
    }
  }

  const suggestions = getSuggestions()

  // Add debounced search for text tokens
  const debouncedSearch = useDebounce((newTokens: SearchToken[]) => {
    onSearch(newTokens)
  }, 150)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    console.log('Input changed:', value)
    setInputValue(value)

    if (value.startsWith('#') && !suggestionType) {
      console.log('Channel suggestions triggered')
      setSuggestionType('channel')
      setShowSuggestions(true)
      setSelectedSuggestionIndex(0)
    } else if (value.startsWith('@') && !suggestionType) {
      console.log('User suggestions triggered')
      setSuggestionType('user')
      setShowSuggestions(true)
      setSelectedSuggestionIndex(0)
    } else if (!value.startsWith('#') && !value.startsWith('@')) {
      setSuggestionType(null)
      setShowSuggestions(false)
      
      // Search with any non-empty value
      if (value) {
        const newTokens = [
          ...tokens,
          { type: 'text', value }
        ]
        debouncedSearch(newTokens)
      } else {
        // If input is empty, search with just the context tokens
        debouncedSearch(tokens)
      }
    }
  }

  const addToken = (suggestion?: SearchSuggestion) => {
    if (suggestionType) {
      if (suggestion) {
        const newTokens = [...tokens, {
          type: suggestionType === 'channel' ? 'channel' : 'user',
          id: suggestion.id,
          value: suggestion.searchValue,
          displayValue: suggestion.displayValue
        }]
        setTokens(newTokens)
        onSearch(newTokens)
      }
      setInputValue('')
      setSuggestionType(null)
      setShowSuggestions(false)
    } else if (inputValue) {
      const newTokens = [...tokens, {
        type: 'text',
        value: inputValue
      }]
      setTokens(newTokens)
      setInputValue('')
      onSearch(newTokens)
    }
  }

  const removeToken = (index: number) => {
    console.log('Removing token at index:', index)
    const tokenToRemove = tokens[index]
    
    // If removing a context token, mark it as manually removed
    if (tokenToRemove && (tokenToRemove.type === 'channel' || tokenToRemove.type === 'user')) {
      hasManuallyRemovedContext.current = true
    }
    
    const newTokens = tokens.filter((_, i) => i !== index)
    console.log('New tokens:', newTokens)
    setTokens(newTokens)
    onSearch(newTokens)
  }

  // Reset the manual removal flag when context changes
  useEffect(() => {
    hasManuallyRemovedContext.current = false
  }, [currentContext?.id])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showSuggestions && suggestions.length > 0) {
        addToken(suggestions[selectedSuggestionIndex])
      } else {
        addToken()
      }
    } else if (e.key === 'Backspace' && !inputValue) {
      e.preventDefault()
      if (tokens.length > 0) {
        removeToken(tokens.length - 1)
      }
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault()
      setSelectedSuggestionIndex(i => 
        i < suggestions.length - 1 ? i + 1 : 0
      )
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault()
      setSelectedSuggestionIndex(i => 
        i > 0 ? i - 1 : suggestions.length - 1
      )
    }
  }

  return (
    <div className="relative flex-1 max-w-xl">
      <div className="relative flex items-center bg-white border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
        <div className="absolute left-3 text-gray-400">
          <Search size={16} />
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-10 pr-3 py-2 min-h-[42px]">
          {tokens.map((token, index) => (
            <span
              key={index}
              className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded"
            >
              {token.type === 'channel' && '#'}
              {token.type === 'user' && '@'}
              {token.displayValue || token.value}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeToken(index)
                }}
                className="text-blue-600 hover:text-blue-800 ml-1 px-1"
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-[200px] outline-none"
            placeholder={tokens.length === 0 ? "Search messages..." : ""}
          />
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => addToken(suggestion)}
              className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${
                index === selectedSuggestionIndex ? 'bg-gray-100' : ''
              }`}
            >
              {suggestion.type === 'channel' ? '#' : '@'}
              {suggestion.displayValue}
            </button>
          ))}
        </div>
      )}
    </div>
  )
} 