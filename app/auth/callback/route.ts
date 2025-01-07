import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.exchangeCodeForSession(code)

    // Try to create profile if it doesn't exist
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select()
        .eq('id', user.id)
        .single()

      if (!profile) {
        await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: user.user_metadata.username || user.email,
            full_name: user.user_metadata.username || user.email,
            email: user.email,
            avatar_url: null,
          })
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL('/dashboard', request.url))
} 