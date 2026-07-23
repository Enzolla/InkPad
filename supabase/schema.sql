-- InkPad schema (safe to re-run)

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id text not null,
  folder_id text,
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

alter table public.items add column if not exists folder_id text;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  accent text not null default 'oklch(0.47 0.185 28)',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists items_user_updated_idx on public.items (user_id, updated_at desc);
create index if not exists items_user_type_idx on public.items (user_id, type);
create index if not exists items_workspace_idx on public.items (user_id, workspace_id);
create index if not exists items_folder_idx on public.items (user_id, folder_id);
create index if not exists workspaces_user_idx on public.workspaces (user_id, sort_order);
create index if not exists folders_workspace_idx on public.folders (user_id, workspace_id, sort_order);

alter table public.items enable row level security;
alter table public.workspaces enable row level security;
alter table public.folders enable row level security;

drop policy if exists "items_select_own" on public.items;
drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_update_own" on public.items;
drop policy if exists "items_delete_own" on public.items;
create policy "items_select_own" on public.items for select using (auth.uid() = user_id);
create policy "items_insert_own" on public.items for insert with check (auth.uid() = user_id);
create policy "items_update_own" on public.items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "items_delete_own" on public.items for delete using (auth.uid() = user_id);

drop policy if exists "workspaces_select_own" on public.workspaces;
drop policy if exists "workspaces_insert_own" on public.workspaces;
drop policy if exists "workspaces_update_own" on public.workspaces;
drop policy if exists "workspaces_delete_own" on public.workspaces;
create policy "workspaces_select_own" on public.workspaces for select using (auth.uid() = user_id);
create policy "workspaces_insert_own" on public.workspaces for insert with check (auth.uid() = user_id);
create policy "workspaces_update_own" on public.workspaces for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workspaces_delete_own" on public.workspaces for delete using (auth.uid() = user_id);

drop policy if exists "folders_select_own" on public.folders;
drop policy if exists "folders_insert_own" on public.folders;
drop policy if exists "folders_update_own" on public.folders;
drop policy if exists "folders_delete_own" on public.folders;
create policy "folders_select_own" on public.folders for select using (auth.uid() = user_id);
create policy "folders_insert_own" on public.folders for insert with check (auth.uid() = user_id);
create policy "folders_update_own" on public.folders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "folders_delete_own" on public.folders for delete using (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.workspaces;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.folders;
  exception when duplicate_object then null;
  end;
end $$;
