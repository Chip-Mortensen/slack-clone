import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with service role key for server operations
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
); 