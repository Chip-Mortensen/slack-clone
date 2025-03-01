import './globals.css'
import { Inter } from 'next/font/google'
import SupabaseProvider from './supabase-provider'
import { UserStatusProvider } from './contexts/UserStatusContext'
import ClientPresenceWrapper from './components/ClientPresenceWrapper'
import { AvatarContextProvider } from './contexts/AvatarContext'
import { NameContextProvider } from './contexts/NameContext'
import { AutoRespondContextProvider } from './contexts/AutoRespondContext'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
})

export const metadata = {
  title: 'Slacker',
  description: 'A simple Slack clone built with Next.js and Supabase',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <SupabaseProvider>
          <UserStatusProvider>
            <AvatarContextProvider>
              <NameContextProvider>
                <AutoRespondContextProvider>
                  <ClientPresenceWrapper />
                  <main className="min-h-screen bg-gradient-to-b from-gray-50 via-gray-100 to-gray-200">
                    {children}
                  </main>
                </AutoRespondContextProvider>
              </NameContextProvider>
            </AvatarContextProvider>
          </UserStatusProvider>
        </SupabaseProvider>
      </body>
    </html>
  )
}
