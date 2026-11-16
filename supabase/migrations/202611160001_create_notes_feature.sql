-- ==============================================================================
-- PRIMNGMT: Notes Workspace Feature Migration
-- Migration: 202611160001_create_notes_feature.sql
-- Description: Creates notes table, foreign keys, indexes, triggers, RLS, and storage bucket
-- ==============================================================================

-- 0. Ensure handle_updated_at trigger function exists
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 1. Create Notes Table
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 250),
  content text not null default '',
  category text not null default 'Personal' check (category in (
    'Meeting Notes', 'Learning Notes', 'Technical Notes', 
    'Project Ideas', 'Research', 'Personal', 'Documentation', 'Other'
  )),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Indexes for High-Performance Queries
create index if not exists idx_notes_user_updated on public.notes(user_id, updated_at desc);
create index if not exists idx_notes_user_project on public.notes(user_id, project_id);
create index if not exists idx_notes_user_category on public.notes(user_id, category);
create index if not exists idx_notes_tags on public.notes using gin (tags);

-- 3. Automatic updated_at Trigger
drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
  before update on public.notes
  for each row execute function public.handle_updated_at();

-- 4. Enable Row Level Security (RLS)
alter table public.notes enable row level security;

-- 5. RLS Policies (Owner-Only Access + Cross-User Project Protection)
drop policy if exists "notes_owner_policy" on public.notes;
create policy "notes_owner_policy" on public.notes
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id and
    (project_id is null or exists (
      select 1 from public.projects where id = project_id and user_id = auth.uid()
    ))
  );

-- 6. Private Storage Bucket for Note Images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-images',
  'note-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

-- 7. Storage RLS Policies
drop policy if exists "note_images_owner_select" on storage.objects;
create policy "note_images_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "note_images_owner_insert" on storage.objects;
create policy "note_images_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "note_images_owner_update" on storage.objects;
create policy "note_images_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "note_images_owner_delete" on storage.objects;
create policy "note_images_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);
