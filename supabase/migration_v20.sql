-- Ensure blocks table exists (idempotent in case migration_v19 was skipped)
create table if not exists blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(blocker_id, blocked_id)
);

alter table blocks enable row level security;

drop policy if exists "Select own blocks"  on blocks;
drop policy if exists "Create blocks"      on blocks;
drop policy if exists "Delete own blocks"  on blocks;

create policy "Select own blocks" on blocks
  for select using (auth.uid() = blocker_id or auth.uid() = blocked_id);

create policy "Create blocks" on blocks
  for insert with check (auth.uid() = blocker_id);

create policy "Delete own blocks" on blocks
  for delete using (auth.uid() = blocker_id);

-- RPC to remove a friend from either side.
-- The friend_requests delete RLS typically only allows the sender to delete,
-- so we use security definer to let either party remove the accepted row.
create or replace function remove_friend(friend_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from friend_requests
  where status = 'accepted'
    and (
      (sender_id   = auth.uid()       and receiver_id = friend_user_id)
      or
      (sender_id   = friend_user_id   and receiver_id = auth.uid())
    );
end;
$$;

grant execute on function remove_friend(uuid) to authenticated;
