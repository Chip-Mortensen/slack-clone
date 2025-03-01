'use client'

import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'
import type { SearchToken, SearchSuggestion } from '@/app/types/search'
import type { Channel, Conversation } from '@/app/types/models'
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
            displayValue: conversations.find(c => c.id === currentContext.id)?.other_user.username || '',
            avatarUrl: conversations.find(c => c.id === currentContext.id)?.other_user.avatar_url,
            fullName: conversations.find(c => c.id === currentContext.id)?.other_user.full_name
          }
      
      setTokens(currentTokens => {
        const currentContextToken = currentTokens.find(t => t.type === 'channel' || t.type === 'user')
        if (!currentTokens.length || (currentContextToken && currentContextToken.id !== contextToken.id)) {
          return [contextToken as SearchToken]
        }
        return currentTokens
      })
    }
  }, [currentContext, channels, conversations])

  // Get suggestions based on current input
  const getSuggestions = (): SearchSuggestion[] => {
    if (!suggestionType || !inputValue) return []

    const searchTerm = inputValue.slice(1).toLowerCase()
    
    if (suggestionType === 'channel') {
      const channelSuggestions = channels
        .filter(channel => 
          channel.name.toLowerCase().includes(searchTerm)
        )
        .map(channel => ({
          type: 'channel' as const,
          id: channel.id,
          displayValue: channel.name,
          searchValue: channel.name.toLowerCase()
        }))
      return channelSuggestions
    } else {
      const userSuggestions = conversations
        .filter(conv => 
          conv.other_user.username.toLowerCase().includes(searchTerm)
        )
        .map(conv => ({
          type: 'user' as const,
          id: conv.id,
          displayValue: conv.other_user.username,
          searchValue: conv.other_user.username.toLowerCase(),
          avatarUrl: conv.other_user.avatar_url,
          fullName: conv.other_user.full_name
        }))
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
    setInputValue(value)

    if (value.startsWith('#') && !suggestionType) {
      setSuggestionType('channel')
      setShowSuggestions(true)
      setSelectedSuggestionIndex(0)
    } else if (value.startsWith('@') && !suggestionType) {
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
          { 
            type: 'text' as const, 
            value: inputValue 
          } as SearchToken
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
          type: suggestionType,
          id: suggestion.id,
          value: suggestion.searchValue,
          displayValue: suggestion.displayValue,
          avatarUrl: suggestion.avatarUrl,
          fullName: suggestion.fullName
        } as SearchToken]
        setTokens(newTokens)
        onSearch(newTokens)
      }
      setInputValue('')
      setSuggestionType(null)
      setShowSuggestions(false)
    } else if (inputValue) {
      const newTokens = [
        ...tokens,
        { 
          type: 'text' as const, 
          value: inputValue 
        } as SearchToken
      ]
      setTokens(newTokens)
      setInputValue('')
      onSearch(newTokens)
    }
  }

  const removeToken = (index: number) => {
    const tokenToRemove = tokens[index]
    
    // If removing a context token, mark it as manually removed
    if (tokenToRemove && (tokenToRemove.type === 'channel' || tokenToRemove.type === 'user')) {
      hasManuallyRemovedContext.current = true
    }
    
    const newTokens = tokens.filter((_, i) => i !== index)
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
    <div className="relative w-[480px]">
      <div className="relative flex items-center bg-gray-100 border rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
        <div className="absolute left-3 text-gray-400">
          <Search size={16} />
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-10 pr-3 py-2 min-h-[42px]">
          {tokens.map((token, index) => (
            <span
              key={index}
              className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded"
            >
              {token.type === 'user' && token.avatarUrl ? (
                <img 
                  src={token.avatarUrl} 
                  alt={token.displayValue || token.value}
                  className="w-5 h-5 rounded-full"
                />
              ) : token.type === 'user' ? (
                <div className="w-5 h-5 rounded-full bg-gray-200" />
              ) : token.type === 'channel' && (
                '#'
              )}
              <span>{token.displayValue || token.value}</span>
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
            className="flex-1 min-w-[200px] outline-none bg-transparent"
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
              <div className="flex items-center gap-2">
                {suggestion.type === 'user' && suggestion.avatarUrl ? (
                  <img 
                    src={suggestion.avatarUrl} 
                    alt={suggestion.displayValue}
                    className="w-6 h-6 rounded-full"
                  />
                ) : suggestion.type === 'user' ? (
                  <div className="w-6 h-6 rounded-full bg-gray-200" />
                ) : suggestion.type === 'channel' && (
                  <span className="text-gray-500">#</span>
                )}
                <div>
                  <div className="font-medium">{suggestion.displayValue}</div>
                  {suggestion.type === 'user' && suggestion.fullName && (
                    <div className="text-sm text-gray-500">{suggestion.fullName}</div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
} 