import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client initialized with service role key for privileged server-side operations.
 * This client has admin privileges and should ONLY be used in server-side code (e.g. API routes).
 * Never expose this client or the service role key to the client side.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
); 