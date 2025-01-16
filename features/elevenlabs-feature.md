# Plan for Adding ElevenLabs Voice Generation to Messages

This document outlines a high-level strategy for integrating asynchronous ElevenLabs voice generation into both channel messages and direct messages.

---

## Overview of Desired Feature

1. When a user sends a message (channel or direct), we immediately store it as we do currently.
2. In the background, we trigger a process that sends the text content to ElevenLabs to generate an audio file (voice version).
3. Once generated, this audio file is uploaded to a new Supabase storage bucket.
4. We then update the corresponding message record with the audio file’s URL (e.g., “voice_url”).
5. On the frontend, whenever a message contains a “voice_url”, we display a small play icon next to the message’s timestamp. Clicking the icon plays the recorded audio.

This plan must be implemented in such a way that messages continue to appear immediately and are usable. The voice version is an optional enhancement that arrives asynchronously.

---

## Database Changes

1. Create a new column on each of the following tables to store the voice file URL (e.g., “voice_url” or “audio_url”). All three tables handle various types of messages:

   - “messages”
   - “direct_messages”
   - “message_replies” (if needed for replies)

2. Create a new storage bucket in Supabase, e.g., “message-voice-recordings,” to store the generated audio files.

3. These migrations should be done carefully so that any existing messages are not impacted, and the new column defaults to NULL or empty.

---

## Backend Steps

### 1. Identify Where Messages Are Inserted

From the codebase search:

- “useMessages” (in app/hooks/useMessages.ts) handles channel messages.
- “useDirectMessageChat” (in app/hooks/useDirectMessageChat.ts) handles direct messages.

We also see message insertion in API routes:

- app/api/channel-chat/route.ts
- app/api/chat/route.ts  
  These insert messages or direct messages into their respective tables.

### 2. Add a Call to the Asynchronous Voice Generator

Whenever the existing code inserts or sends a new message:

1. Store the text message as usual.
2. Enqueue or trigger a background call (for instance, a serverless function or specialized job) to:
   - Send the text to ElevenLabs.
   - Receive the generated audio file.
   - Upload the audio file to the new “message-voice-recordings” Supabase bucket.
   - Update the relevant message row with the “voice_url.”

### 3. Implement the Background Process

A dedicated module or script could be responsible for:

1. Interfacing with ElevenLabs (using their API).
2. Uploading the resultant audio to Supabase storage.
3. Updating the Supabase row with the new audio URL.

This separation ensures the original request flow is quick (the message is created in real-time, user doesn’t have to wait on audio).

### 4. Ensure Real-Time Updates

The existing real-time subscriptions (found in “useMessages” and “useDirectMessageChat”) should already update the UI whenever the record changes. Once “voice_url” is updated, it can trigger the UI to display the new play icon.

---

## Frontend Steps

1. **UI for Audio Playback**

   - In “MessageList” or wherever messages are displayed, check if “voice_url” exists in the message object.
   - If it does, render a play icon near the timestamp.
   - On click, play the audio file using a basic HTML5 audio element or another audio component in React.

2. **Revision of Existing Hooks**

   - “useMessages” and “useDirectMessageChat” might need to handle the new “voice_url” field in queries or subscription events.
   - Ensure that the message objects passed to the UI include the “voice_url” if present.

3. **Edge Cases**
   - If ElevenLabs fails or is slow, confirm that the UI gracefully continues with just the textual content.
   - Playback should be optional and only enabled if the “voice_url” is set.

---

## File and Implementation References

Below is a suggested entry point for each relevant area, referencing key files without showing code:

1. **Database Columns**

   - Migrations or direct DDL changes to the “messages,” “direct_messages,” and possibly “message_replies” tables.

2. **Storage Bucket**

   - Setup in Supabase admin panel or via a script for “message-voice-recordings.”

3. **Server-Side Insert Points**

   - “useMessages” (app/hooks/useMessages.ts) → specifically the “sendMessage” function.
   - “useDirectMessageChat” (app/hooks/useDirectMessageChat.ts) → specifically the “sendMessage” function.
   - “app/api/channel-chat/route.ts” and “app/api/chat/route.ts” if those are used for AI-based or channel-based message insertion.

4. **Voice Generation Script**

   - Possibly a new serverless function, e.g., “/api/generate-voice/route.ts” or an external script that runs. This script must handle calling ElevenLabs and storing the result.

5. **UI Playback**
   - “MessageList” (app/components/MessageList.tsx) → modification to display a play icon when “voice_url” is present.
   - Optionally, separate “Message” component if needed.

---

## Testing and Verification

1. **Send a New Message**
   - Verify it appears immediately.
2. **Check the Background Process**
   - Confirm the asynchronous request to ElevenLabs is triggered and completes.
3. **Observe UI Update**

   - Verify that the “voice_url” is populated in the database.
   - Ensure the UI picks this up automatically and shows the play icon.
   - Clicking the play icon in the UI should successfully play the generated audio.

4. **Error Logs**
   - Ensure that if ElevenLabs is unreachable or the storage fails, the user’s main message flow is unaffected. Logs can appear for the error but do not disrupt the immediate posting of messages.

---

## Summary

By adding a new column to the tables, creating a dedicated storage bucket, and triggering an asynchronous job to ElevenLabs, we maintain immediate message posting while still enhancing each message with a voice recording. Carefully updating the existing real-time subscriptions in the frontend ensures that the play icon appears once “voice_url” is ready. This approach allows for minimal impact on the user experience while adding a robust new feature.
