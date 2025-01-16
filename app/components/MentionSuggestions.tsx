import { useEffect, useRef } from 'react'
import type { Profile } from '@/app/types/models'

// Type for profile suggestions (subset of Profile)
type ProfileSuggestion = Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'>

interface MentionSuggestionsProps {
  query: string
  suggestions: ProfileSuggestion[]
  onSelect: (profile: ProfileSuggestion) => void
  selectedIndex: number
  visible: boolean
  inputRect?: DOMRect | null
}

export default function MentionSuggestions({
  query,
  suggestions,
  onSelect,
  selectedIndex,
  visible,
  inputRect
}: MentionSuggestionsProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownRef.current || !inputRect || !visible) return

    const dropdown = dropdownRef.current
    const updatePosition = () => {
      // Position relative to input
      dropdown.style.position = 'fixed'
      dropdown.style.top = `${inputRect.bottom}px`
      dropdown.style.left = `${inputRect.left}px`
      
      // Ensure dropdown is visible within viewport
      const dropdownRect = dropdown.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      
      if (dropdownRect.bottom > viewportHeight) {
        dropdown.style.top = `${inputRect.top - dropdownRect.height}px`
      }
      
      if (dropdownRect.right > viewportWidth) {
        dropdown.style.left = `${viewportWidth - dropdownRect.width - 4}px`
      }
    }

    // Initial position
    updatePosition()

    // Create observer to watch for size changes
    const resizeObserver = new ResizeObserver(() => {
      updatePosition()
    })

    resizeObserver.observe(dropdown)

    return () => {
      resizeObserver.disconnect()
    }
  }, [inputRect, visible, suggestions.length])

  if (!visible || suggestions.length === 0) {
    return null
  }

  return (
    <div 
      ref={dropdownRef}
      className="fixed z-[9999] w-64 bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden"
    >
      <div className="max-h-48 overflow-y-auto py-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            className={`w-full text-left px-3 py-2 flex items-center gap-2 ${
              index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
            onClick={() => onSelect(suggestion)}
          >
            {suggestion.avatar_url ? (
              <img 
                src={suggestion.avatar_url} 
                alt={suggestion.username}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200" />
            )}
            <div>
              <div className="font-medium">{suggestion.username}</div>
              {suggestion.full_name && (
                <div className="text-sm text-gray-500">{suggestion.full_name}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
} 