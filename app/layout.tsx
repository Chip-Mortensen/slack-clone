import './globals.css'
import { Inter } from 'next/font/google'
import SupabaseProvider from './supabase-provider'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
})

export const metadata = {
  title: 'Slack Clone',
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
          <main className="min-h-screen bg-gray-100">
            {children}
          </main>
        </SupabaseProvider>
      </body>
    </html>
  )
}
