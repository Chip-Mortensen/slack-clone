'use client'

import { AvatarContextProvider } from './contexts/AvatarContext'
import { NameContextProvider } from './contexts/NameContext'
import { UserStatusProvider } from './contexts/UserStatusContext'
import { AutoRespondContextProvider } from './contexts/AutoRespondContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AvatarContextProvider>
      <NameContextProvider>
        <UserStatusProvider>
          <AutoRespondContextProvider>
            {children}
          </AutoRespondContextProvider>
        </UserStatusProvider>
      </NameContextProvider>
    </AvatarContextProvider>
  )
} 