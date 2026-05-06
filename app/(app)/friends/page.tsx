import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FriendsList from '@/components/FriendsList'

export default async function FriendsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  return <FriendsList currentUserId={user.id} />
}
