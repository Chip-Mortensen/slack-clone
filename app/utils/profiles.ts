import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with service role key for server operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Profile {
  id: string;
  username: string;
}

// Fetch all profiles from the Supabase `profiles` table
export async function fetchProfiles() {
  try {
    const { data, error } = await supabase.from("profiles").select("id, username");

    if (error) {
      console.error("Error fetching profiles:", error);
      return {};
    }

    if (data) {
      const profiles: Record<string, string> = {};
      data.forEach((profile: Profile) => {
        profiles[profile.id] = profile.username;
      });
      return profiles;
    }

    return {};
  } catch (error) {
    console.error("Error fetching profiles:", error);
    return {};
  }
} 