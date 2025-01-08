'use client'

import dynamic from 'next/dynamic'

const PresenceHandler = dynamic(() => import('./PresenceHandler'), { ssr: false })

export default function ClientPresenceWrapper() {
  return <PresenceHandler />
} 