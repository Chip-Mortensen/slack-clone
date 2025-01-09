import type { User } from '@supabase/auth-helpers-nextjs'

export interface AuthUser extends User {
  user_metadata: {
    username?: string
  }
} 