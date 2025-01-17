import { supabase } from "../../lib/supabase-service";

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