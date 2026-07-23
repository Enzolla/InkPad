-- InkPad cloud schema (run once in Supabase SQL Editor)

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id text not null,
  type text not null check (type in ('note', 'sql', 'event')),
  title text not null default '',
  content text not null default '',
  pinned boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_user_updated_idx
  on public.items (user_id, updated_at desc);

create index if not exists items_user_type_idx
  on public.items (user_id, type);

alter table public.items enable row level security;

drop policy if exists "items_select_own" on public.items;
drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_update_own" on public.items;
drop policy if exists "items_delete_own" on public.items;

create policy "items_select_own"
  on public.items for select
  using (auth.uid() = user_id);

create policy "items_insert_own"
  on public.items for insert
  with check (auth.uid() = user_id);

create policy "items_update_own"
  on public.items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "items_delete_own"
  on public.items for delete
  using (auth.uid() = user_id);

-- Realtime (optional, safe if already added)
do $$
begin
  begin
    alter publication supabase_realtime add table public.items;
  exception
    when duplicate_object then null;
  end;
end $$;
