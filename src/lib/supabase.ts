import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client — uses cookies for session persistence
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (uses service role, bypasses RLS)
export function createServiceClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
