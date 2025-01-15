# AI Responses for Message Replies

## Overview

Extend the existing AI response system to support message replies in channel threads, allowing users with auto-respond enabled to automatically respond to mentions in thread replies.

## Current Structure

- Message replies are stored in the `message_replies` table
- Replies are linked to parent messages via `message_id`
- The `ThreadSidebar` component handles reply display and submission
- Existing AI response system handles channel messages and direct messages

## Implementation Plan

### 1. Context Handling

- Extend `buildContextFromDocs` to handle reply context:
  - Include parent message for context
  - Include surrounding replies in the thread
  - Maintain chronological order of messages
  - Use existing `fetchMessageContext` utility

### 2. API Endpoint

Create a new endpoint `/api/reply-chat` that will:

- Accept reply context (parent message, thread content)
- Use existing profile and context fetching
- Generate appropriate AI responses
- Insert responses as replies to the original message

### 3. Reply Detection System

Modify `ThreadSidebar` component to:

- Extract mentions from replies using existing mention detection
- Check mentioned users' auto-respond settings
- Trigger AI responses for eligible users

### 4. Response Generation

- Use existing AI utilities with thread-specific context
- Maintain consistent user style and tone
- Ensure responses are appropriate for thread context

### 5. Real-time Updates

- Leverage existing Supabase real-time subscriptions
- Update thread view when AI responses are added
- Maintain proper scroll behavior

## Technical Considerations

### Database

- Use existing `message_replies` table structure
- No schema changes required
- Maintain existing relationships and foreign keys

### Performance

- Batch AI response generation for multiple mentions
- Reuse existing context fetching optimizations
- Maintain efficient real-time updates

### Error Handling

- Handle failed AI responses gracefully
- Maintain thread consistency
- Log errors appropriately

### User Experience

- Show loading states for AI responses
- Maintain thread scroll position
- Ensure smooth transitions for new replies

## Next Steps

1. Implement reply context handling in AI utilities
2. Create the reply-chat endpoint
3. Update ThreadSidebar with mention detection
4. Test with various thread scenarios
5. Monitor performance and adjust as needed
