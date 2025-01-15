// Token format: @[username]
const TOKEN_START = '@['
const TOKEN_END = ']'

/**
 * Extracts all user mentions from a message
 * @param text The message text to parse
 * @returns Array of usernames mentioned in the text
 */
export function extractMentions(text: string): string[] {
  const mentions: string[] = []
  const regex = new RegExp(`${TOKEN_START}(.*?)${TOKEN_END}`, 'g')
  let match

  while ((match = regex.exec(text)) !== null) {
    mentions.push(match[1])
  }

  return mentions
}

/**
 * Formats a username as a mention token
 * @param username The username to format
 * @returns The formatted mention token
 */
export function formatMention(username: string): string {
  return `${TOKEN_START}${username}${TOKEN_END}`
}

/**
 * Checks if text contains a valid mention token format
 * @param text The text to check
 * @returns boolean indicating if the text contains a valid mention
 */
export function hasMention(text: string): boolean {
  const regex = new RegExp(`${TOKEN_START}.*?${TOKEN_END}`)
  return regex.test(text)
}

/**
 * Escapes special characters in text that might interfere with token parsing
 * @param text The text to escape
 * @returns The escaped text
 */
export function escapeText(text: string): string {
  return text
    .replace(/@\[/g, '\\@[')
    .replace(/\]/g, '\\]')
}

/**
 * Unescapes previously escaped text
 * @param text The text to unescape
 * @returns The unescaped text
 */
export function unescapeText(text: string): string {
  return text
    .replace(/\\@\[/g, '@[')
    .replace(/\\\]/g, ']')
}

/**
 * Splits text into parts, separating mention tokens from regular text
 * @param text The text to split
 * @returns Array of parts, each with type 'text' or 'mention' and its content
 */
export function splitTextAndMentions(text: string): Array<{
  type: 'text' | 'mention'
  content: string
}> {
  const parts: Array<{ type: 'text' | 'mention', content: string }> = []
  const regex = new RegExp(`(${TOKEN_START}.*?${TOKEN_END})`, 'g')
  
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Add text before the mention if any
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      })
    }

    // Add the mention
    parts.push({
      type: 'mention',
      content: match[1].slice(TOKEN_START.length, -TOKEN_END.length) // Remove @[ and ]
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text if any
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    })
  }

  return parts
} 