export interface SearchToken {
  type: 'channel' | 'user' | 'text'
  id?: string | number
  value: string
  displayValue?: string
  avatarUrl?: string
  fullName?: string
}

export interface SearchSuggestion {
  type: 'channel' | 'user'
  id: string | number
  displayValue: string
  searchValue: string
  avatarUrl?: string
  fullName?: string
} 