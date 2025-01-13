# Profile Requests Investigation

## Current Issues Summary

- ~50 requests/second to profiles table
- Multiple overlapping subscriptions
- Duplicate profile fetching
- No caching strategy
- Aggressive polling intervals

## Implementation Checklist

### Phase 1: Emergency Stabilization

- [ ] 1.1. Increase all polling intervals

  - [ ] Update usePresence heartbeat: 5s → 30s
  - [ ] Update UserAvatar status check: 10s → 60s
  - [ ] Update presence stale check: 10s → 30s

- [ ] 1.2. Implement Basic Caching
  - [ ] Create temporary cache utility
  - [ ] Add cache to existing contexts
  - [ ] Implement cache invalidation strategy

### Phase 2: ProfileContext Implementation

- [ ] 2.1. Create Base Structure

  - [ ] Define interfaces and types
  - [ ] Create context and provider
  - [ ] Implement basic state management

- [ ] 2.2. Implement Core Features

  - [ ] Add in-memory LRU cache
  - [ ] Create batch request handler
  - [ ] Add request deduplication
  - [ ] Implement error handling

- [ ] 2.3. Add Real-time Updates
  - [ ] Set up single subscription channel
  - [ ] Implement update handlers
  - [ ] Add presence integration
  - [ ] Handle subscription cleanup

### Phase 3: Component Migration

- [ ] 3.1. Update Core Components

  - [ ] Modify UserAvatar.tsx
  - [ ] Update Message components
  - [ ] Revise ChatArea.tsx
  - [ ] Update ThreadSidebar.tsx

- [ ] 3.2. Remove Old Contexts

  - [ ] Migrate from AvatarContext
  - [ ] Migrate from NameContext
  - [ ] Migrate from UserStatusContext
  - [ ] Update all imports

- [ ] 3.3. Optimize Message Loading
  - [ ] Implement virtual scrolling
  - [ ] Add profile pre-fetching
  - [ ] Optimize message rendering
  - [ ] Add load boundaries

### Phase 4: Performance Optimization

- [ ] 4.1. Request Optimization

  - [ ] Implement request queuing
  - [ ] Add request batching
  - [ ] Optimize polling strategy
  - [ ] Add rate limiting

- [ ] 4.2. Cache Optimization

  - [ ] Add persistent cache layer
  - [ ] Implement cache warming
  - [ ] Add cache analytics
  - [ ] Optimize cache invalidation

- [ ] 4.3. Real-time Optimization
  - [ ] Implement selective updates
  - [ ] Add subscription pooling
  - [ ] Optimize presence tracking
  - [ ] Add reconnection handling

### Phase 5: Testing & Monitoring

- [ ] 5.1. Performance Testing

  - [ ] Add request tracking
  - [ ] Implement performance metrics
  - [ ] Create load tests
  - [ ] Document baseline metrics

- [ ] 5.2. Error Handling

  - [ ] Add error boundaries
  - [ ] Implement fallback UI
  - [ ] Add error reporting
  - [ ] Create recovery strategies

- [ ] 5.3. Monitoring
  - [ ] Add performance monitoring
  - [ ] Set up alerts
  - [ ] Create dashboard
  - [ ] Document thresholds

## Success Metrics

- [ ] Profile requests reduced to < 1/second per user
- [ ] Cache hit rate > 95%
- [ ] Real-time updates within 1s
- [ ] No duplicate requests
- [ ] Memory usage stable
- [ ] CPU usage optimized

## Files to Modify

1. `/app/contexts/`

   - [ ] Create ProfileContext.tsx
   - [ ] Remove AvatarContext.tsx
   - [ ] Remove NameContext.tsx
   - [ ] Update UserStatusContext.tsx

2. `/app/components/`

   - [ ] Update UserAvatar.tsx
   - [ ] Modify Message.tsx
   - [ ] Revise ChatArea.tsx
   - [ ] Update ThreadSidebar.tsx

3. `/app/hooks/`
   - [ ] Create useProfile.ts
   - [ ] Update usePresence.ts
   - [ ] Create useCacheManager.ts
   - [ ] Create useProfileBatch.ts

## Expected Database Load Reduction

### Current Load

- ~50 requests/second/user to profiles table
- Each user triggers:
  - Avatar context fetch every profile change
  - Name context fetch every profile change
  - Status checks every 10 seconds
  - Presence updates every 5 seconds
  - Individual profile loads for each message view

### After Phase 1 (Emergency Stabilization)

- Expected reduction to ~10 requests/second/user
- Achieved by:
  - Increasing polling intervals
  - Basic request deduplication
  - Simple in-memory caching

### After Phase 2 (ProfileContext)

- Expected reduction to ~2-3 requests/second/user
- Achieved by:
  - Single real-time subscription
  - LRU caching
  - Request batching
  - Unified profile management

### After Full Implementation

- Expected final load: < 1 request/second/user
- Breakdown per user:
  - Initial profile batch load: 1 request
  - Real-time updates: ~0.1 requests/second
  - Presence updates: 1 request/30 seconds
  - Status updates: 1 request/60 seconds
  - Cache refreshes: 1 request/5 minutes

### Additional Benefits

- Reduced database CPU usage by ~95%
- Reduced database IO by ~90%
- Improved client performance
- Better error resilience
- More predictable scaling

Would you like to proceed with Phase 1 to get the immediate reduction to ~10 requests/second?
