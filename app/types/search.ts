export type SearchToken = {
  type: 'channel' | 'user' | 'text'
  value: string
  // For channels/users, we store both display value and actual ID
  id?: string | number
  displayValue?: string
}

export type SearchSuggestion = {
  type: 'channel' | 'user'
  id: string | number
  displayValue: string
  searchValue: string // The value to match against when filtering suggestions
} 