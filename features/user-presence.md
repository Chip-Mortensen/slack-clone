# User Presence System (Next.js + Supabase)

A comprehensive guide for implementing a Slack-like user presence system with real-time online/offline statuses. This document combines feature requirements, implementation details, and checklists in one place.

---

## Key Features

1. **Simple Status**  
   Binary online/offline state based on active sessions.
2. **Quick Updates**  
   5-second heartbeat interval to indicate active user sessions.
3. **Automatic Cleanup**  
   Server marks users offline after 10 seconds of inactivity.
4. **Browser Close Detection**  
   Attempts to mark user offline when the browser closes.
5. **Real-time Updates**  
   All connected clients see status changes immediately.

---

## Edge Cases Handled

1. **Browser Crash**  
   Server-side cleanup marks user offline after missed heartbeats.
2. **Network Issues**  
   Server cleanup handles disconnected clients automatically.
3. **Multiple Tabs**  
   User remains online as long as any tab is active and sending heartbeats.
4. **System Sleep**  
   Server cleanup handles devices that go to sleep or are suspended.
5. **Hard Shutdowns**  
   Server cleanup ensures eventual consistency, even with abrupt client shutdowns.

---

## Advantages of This Approach

1. **Reliability**  
   Server-side cleanup ensures a consistent and accurate online/offline state.
2. **Simplicity**  
   A binary online/offline state is easy to understand and maintain.
3. **Performance**  
   Minimal database writes (one per 5 seconds per active user) keep load manageable.
4. **Scalability**  
   Works well with multiple application instances and user tabs.
5. **Real-time**  
   Status changes are reflected immediately for all connected clients.

---

## Implementation Notes

1. **Intervals**
   - Maintain a heartbeat interval of **5 seconds**.
   - Cleanup interval of **10 seconds** ensures that missed heartbeats trigger offline status.
2. **Synchronous XHR on `beforeunload`**
   - Helps ensure the “going offline” request completes when the user closes the browser.
3. **RLS Policies**
   - Properly configure Row-Level Security (RLS) policies for inserts, updates, and selects.
4. **Database Load**
   - Monitor the presence table for write volume (one write per user every 5 seconds).
5. **Indexing**
   - Consider adding indexes on `updated_at` or `last_seen` if queries degrade over time.

---

## Monitoring

Use these metrics to ensure the system remains healthy under real-world usage:

1. **Number of Active Sessions**
   - Track how many users are online at once.
2. **Cleanup Job Execution Time**
   - Ensure the cleanup process remains efficient.
3. **Presence Table Size**
   - Monitor growth and prune or archive old data if needed.
4. **Real-time Subscription Performance**
   - Verify minimal latency in presence updates.
5. **API Endpoint Response Times**
   - Keep an eye on API latencies.

---

# User Presence Implementation Checklist

Below are step-by-step items to ensure full coverage for your user presence feature.

## 1. Database Setup

- [x] **Create `user_presence` table**
  - [x] Has `user_id` (UUID)
  - [x] Has `is_online` (boolean)
  - [x] Has `last_seen` (timestamp)
  - [x] Has `created_at` (timestamp)
- [x] **Create `updated_at` trigger**
- [x] **Enable RLS** (appears to be enabled based on the Supabase UI)
- [x] **Add RLS policies**
  - [x] Update policy for own presence
  - [x] Insert policy for own presence
  - [x] Select policy for all authenticated users
- [x] **Create cleanup function for stale sessions**
- [x] **Set up cleanup mechanism** (Changed from cron job to client-side timestamp checking)

---

## 2. Hook Implementation

- [x] **Create `usePresence` hook** with:
  - [x] **Initial fetch** of online users
  - [x] **Real-time subscription** to presence changes
  - [x] **Heartbeat mechanism** (5-second interval)
  - [x] **Cleanup on unmount**
  - [x] **Browser visibility handling**
  - [x] **Browser close handling**

---

## 3. Component Updates

- [x] **Update `UserAvatar` component**
- [x] **Add `onlineUsers` prop to `MessageList`**
- [x] **Add `onlineUsers` prop to `Sidebar`**
- [x] **Add `onlineUsers` prop to `ChatArea`**
- [x] **Initialize `usePresence` in `Dashboard`**
- [x] **Remove `console.log` debugging statements**

---

## 4. Edge Cases to Test

- [ ] **Browser close detection**
  - Ensure offline status is set when user closes the browser.
- [ ] **Network disconnection**
  - Server cleanup should mark the user offline if heartbeats are not received.
- [ ] **Multiple tabs**
  - Verify user stays online if at least one tab sends heartbeats.
- [ ] **System sleep/wake**
  - Confirm offline status is handled if a device sleeps for more than the cleanup interval.
- [ ] **Presence update timing**
  - Ensure users transition offline around 10 seconds of no heartbeat.
- [ ] **Cleanup job**
  - Confirm the scheduled job consistently marks users offline after inactivity threshold.

---

## 5. Performance Verification

- [ ] **Monitor database writes** (should be 1 per user per 5s)
  - Look out for spikes that might suggest bugs.
- [ ] **Check real-time subscription performance**
  - Users should see near-instant updates.
- [ ] **Verify cleanup job execution time**
  - The job should run quickly even with many active sessions.
- [ ] **Test with multiple concurrent users**
  - Confirm the system remains responsive at scale.
- [ ] **Check memory usage**
  - Especially important for long sessions or large user bases.

---

## 6. Final Steps

- [x] **Remove any remaining debug code**
  - Removed all console.log statements from presence implementation
- [ ] **Add error handling** for failed presence updates
  - Handle network issues and retries gracefully.
- [ ] **Document the presence system**
  - Make sure everyone on the team knows how it works.
- [ ] **Add monitoring** for system health
  - Track metrics over time to proactively address issues.

---

**End of Document**  
Use this checklist and reference to implement, test, and maintain your user presence feature in a Slack-like environment with Next.js and Supabase.
