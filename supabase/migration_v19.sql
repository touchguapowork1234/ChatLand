-- Blocks table
create table if not exists blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(blocker_id, blocked_id)
);

alter table blocks enable row level security;

-- Both parties can see a block so the blocked user can detect they are blocked
create policy "Select own blocks" on blocks
  for select using (auth.uid() = blocker_id or auth.uid() = blocked_id);

create policy "Create blocks" on blocks
  for insert with check (auth.uid() = blocker_id);

create policy "Delete own blocks" on blocks
  for delete using (auth.uid() = blocker_id);
