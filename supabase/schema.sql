-- ==============================================================================
-- PERSONAL PROJECT MANAGEMENT & PRODUCTIVITY DASHBOARD
-- Supabase PostgreSQL Relational Database Schema
-- Exclusively for Individual Personal Use with Row Level Security (RLS)
-- Timezone: Asia/Kolkata
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ==============================================================================
-- 1. PROJECTS TABLE
-- ==============================================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  description text default '',
  category text not null default 'General',
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Critical')),
  start_date date not null,
  target_date date not null,
  due_date date, -- kept aligned with target_date
  status text not null default 'pending' check (status in ('pending', 'completed', 'Planning', 'In Progress', 'Completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure target_date and due_date exist if projects was previously created
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='target_date') then
    alter table public.projects add column target_date date;
    update public.projects set target_date = coalesce(due_date, start_date, current_date);
    alter table public.projects alter column target_date set not null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='completed_at') then
    alter table public.projects add column completed_at timestamptz;
  end if;
  -- Relax legacy status check constraint if it was overly restrictive
  if exists (select 1 from pg_constraint where conname = 'projects_status_check') then
    alter table public.projects drop constraint projects_status_check;
    alter table public.projects add constraint projects_status_check check (status in ('pending', 'completed', 'Planning', 'Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled'));
  end if;
end $$;

create index if not exists idx_projects_user_target on public.projects(user_id, target_date);
create index if not exists idx_projects_user_status on public.projects(user_id, status);

-- ==============================================================================
-- 2. PROJECT TASKS TABLE
-- ==============================================================================
create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  description text default '',
  start_date date not null,
  target_date date not null,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Critical')),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_tasks_project_id on public.project_tasks(project_id);
create index if not exists idx_project_tasks_user_target on public.project_tasks(user_id, target_date);
create index if not exists idx_project_tasks_status on public.project_tasks(user_id, status);

-- ==============================================================================
-- 3. TO-DO ITEMS TABLE (Daily, Weekly, Monthly Sticky Notes)
-- ==============================================================================
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  description text default '',
  type text not null check (type in ('daily', 'weekly', 'monthly')),
  color text not null default 'yellow' check (color in ('yellow', 'peach', 'green', 'blue', 'purple', 'pink')),
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Critical')),
  target_date date not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_todos_user_type on public.todos(user_id, type);
create index if not exists idx_todos_user_target on public.todos(user_id, target_date);
create index if not exists idx_todos_user_status on public.todos(user_id, status);

-- ==============================================================================
-- 4. COMPLETION TRACKING HISTORY TABLE
-- ==============================================================================
create table if not exists public.completion_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  item_type text not null check (item_type in ('project', 'task', 'daily_todo', 'weekly_todo', 'monthly_todo')),
  item_name text not null,
  category text,
  project_name text,
  original_deadline date,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_history_user_completed on public.completion_history(user_id, completed_at desc);
create index if not exists idx_history_user_item on public.completion_history(user_id, item_id);

-- ==============================================================================
-- 5. EMAIL NOTIFICATION LOGS TABLE (For Automated 2-day-before & Overdue reminders)
-- ==============================================================================
create table if not exists public.email_notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  item_type text not null check (item_type in ('project', 'task', 'daily_todo', 'weekly_todo', 'monthly_todo')),
  item_name text not null,
  notification_type text not null check (notification_type in ('two_days_before', 'overdue')),
  recipient_email text not null,
  reference_date date not null, -- target_date for 2_days_before, or current Asia/Kolkata date for overdue
  sent_at timestamptz not null default now(),
  status text not null default 'sent',
  constraint email_notifications_unique unique (item_id, notification_type, reference_date)
);

create index if not exists idx_email_logs_item on public.email_notification_logs(item_id, notification_type);
create index if not exists idx_email_logs_sent_at on public.email_notification_logs(sent_at desc);

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;
alter table public.todos enable row level security;
alter table public.completion_history enable row level security;
alter table public.email_notification_logs enable row level security;

-- Projects RLS
drop policy if exists "projects_owner_policy" on public.projects;
create policy "projects_owner_policy" on public.projects
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Project Tasks RLS
drop policy if exists "project_tasks_owner_policy" on public.project_tasks;
create policy "project_tasks_owner_policy" on public.project_tasks
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Todos RLS
drop policy if exists "todos_owner_policy" on public.todos;
create policy "todos_owner_policy" on public.todos
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Completion History RLS
drop policy if exists "completion_history_owner_policy" on public.completion_history;
create policy "completion_history_owner_policy" on public.completion_history
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Email Notification Logs RLS (Users can see their own logs; service role can do all)
drop policy if exists "email_logs_owner_policy" on public.email_notification_logs;
create policy "email_logs_owner_policy" on public.email_notification_logs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ==============================================================================
-- 7. HELPER FUNCTION: SYNC UPDATED_AT TIMESTAMP
-- ==============================================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

drop trigger if exists set_project_tasks_updated_at on public.project_tasks;
create trigger set_project_tasks_updated_at
  before update on public.project_tasks
  for each row execute function public.handle_updated_at();

drop trigger if exists set_todos_updated_at on public.todos;
create trigger set_todos_updated_at
  before update on public.todos
  for each row execute function public.handle_updated_at();
