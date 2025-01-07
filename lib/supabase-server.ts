import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function createServerSupabase() {
  // @ts-ignore - Known issue with Next.js 14 and Supabase auth helpers
  return createServerComponentClient({
    cookies,
  })
} 