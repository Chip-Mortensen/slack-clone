import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { userId } = await request.json()

  await supabase
    .from('user_presence')
    .upsert({
      user_id: userId,
      is_online: false,
      last_seen: new Date().toISOString()
    })

  return NextResponse.json({ success: true })
} 