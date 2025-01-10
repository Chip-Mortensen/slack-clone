import { useRef, useCallback } from 'react'

interface ScrollState {
  isAtBottom: boolean
  lastScrollTop: number
  isScrolling: boolean
  shouldAutoScroll: boolean
  isInitialLoad: boolean
  navigationSource: 'sidebar' | 'search' | null
  pendingImageLoads: number
}

export function useScrollManager() {
  const state = useRef<ScrollState>({
    isAtBottom: true,
    lastScrollTop: 0,
    isScrolling: false,
    shouldAutoScroll: true,
    isInitialLoad: true,
    navigationSource: null,
    pendingImageLoads: 0
  })

  const isNearBottom = useCallback((container: HTMLElement, threshold = 100) => {
    const { scrollHeight, scrollTop, clientHeight } = container
    return scrollHeight - scrollTop - clientHeight < threshold
  }, [])

  const handleScroll = useCallback((container: HTMLElement) => {
    if (!container || state.current.isScrolling) return

    const wasAtBottom = state.current.isAtBottom
    state.current.isAtBottom = isNearBottom(container)
    state.current.lastScrollTop = container.scrollTop
    
    // Only update shouldAutoScroll if this isn't a programmatic scroll
    // and we're transitioning to/from bottom or it's a sidebar navigation
    if (!state.current.isScrolling) {
      if (state.current.navigationSource === 'sidebar') {
        state.current.shouldAutoScroll = true
      } else if (wasAtBottom !== state.current.isAtBottom) {
        state.current.shouldAutoScroll = state.current.isAtBottom
      }
    }
  }, [isNearBottom])

  const scrollToBottom = useCallback((container: HTMLElement, options: { 
    force?: boolean;
    behavior?: ScrollBehavior;
  } = {}) => {
    if (!container) return;

    const { force = false, behavior = 'smooth' } = options;
    const targetScroll = container.scrollHeight - container.clientHeight;

    // For sidebar navigation, always force scroll regardless of state
    if (state.current.navigationSource === 'sidebar') {
      state.current.isScrolling = true;
      container.scrollTop = targetScroll;
      state.current.isScrolling = false;
      state.current.isAtBottom = true;
      state.current.shouldAutoScroll = true;
      state.current.isInitialLoad = false;
      return;
    }

    // For initial loads, sidebar navigation, or forced scrolls, use immediate positioning
    if (state.current.isInitialLoad || force) {
      state.current.isScrolling = true;
      container.scrollTop = targetScroll;
      state.current.isScrolling = false;
      state.current.isInitialLoad = false;
      return;
    }

    // For all other cases (like new messages when at bottom), use smooth scrolling
    if (state.current.shouldAutoScroll) {
      state.current.isScrolling = true;
      container.scrollTo({
        top: targetScroll,
        behavior
      });

      setTimeout(() => {
        state.current.isScrolling = false;
      }, behavior === 'smooth' ? 300 : 0);
    }
  }, []);

  const scrollToMessage = useCallback((container: HTMLElement, messageId: string | number) => {
    if (!container) return
    
    const messageElement = document.getElementById(`message-${messageId}`)
    if (!messageElement) return

    state.current.isScrolling = true
    state.current.shouldAutoScroll = false

    const messageTop = messageElement.offsetTop
    const scrollPosition = messageTop - (container.clientHeight / 3)
    
    // Use immediate scroll for same-channel searches
    if (state.current.navigationSource === 'search') {
      container.scrollTop = scrollPosition
      
      // Highlight the message
      messageElement.classList.add('bg-yellow-100')
      requestAnimationFrame(() => {
        // Double-check scroll position
        if (container.scrollTop !== scrollPosition) {
          container.scrollTop = scrollPosition
        }
        
        setTimeout(() => {
          messageElement.classList.remove('bg-yellow-100')
          state.current.isScrolling = false
        }, 2000)
      })
    } else {
      container.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      })

      messageElement.classList.add('bg-yellow-100')
      setTimeout(() => {
        messageElement.classList.remove('bg-yellow-100')
        state.current.isScrolling = false
      }, 2000)
    }
  }, [])

  const handleImageLoad = useCallback(() => {
    state.current.pendingImageLoads = Math.max(0, state.current.pendingImageLoads - 1)
  }, [])

  const resetScrollState = useCallback((navigationSource: 'sidebar' | 'search' | null = null) => {
    // For sidebar navigation, force all scroll states to their initial values
    if (navigationSource === 'sidebar') {
      state.current = {
        isAtBottom: true,
        lastScrollTop: 0,
        isScrolling: false,
        shouldAutoScroll: true,
        isInitialLoad: true,
        navigationSource,
        pendingImageLoads: 0
      }
    } else {
      state.current = {
        ...state.current,
        isInitialLoad: true,
        isAtBottom: false,
        shouldAutoScroll: false,
        navigationSource,
        pendingImageLoads: 0,
        lastScrollTop: 0,
      }
    }
  }, [])

  return {
    state: state.current,
    isNearBottom,
    handleScroll,
    scrollToBottom,
    scrollToMessage,
    handleImageLoad,
    resetScrollState
  }
} 