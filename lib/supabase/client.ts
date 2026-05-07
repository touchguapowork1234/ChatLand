import { createBrowserClient } from '@supabase/ssr'

// Singleton — all components share one WebSocket connection.
// Creating a new client per render was causing orphaned subscriptions.
let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}
