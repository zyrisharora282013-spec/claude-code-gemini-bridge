-- Schema for the website's email signup + download counter.
-- Apply in Supabase Dashboard > SQL Editor (or via the CLI / MCP).
create table if not exists public.email_signups (
  id bigint generated always as identity primary key,
  email text not null check (char_length(email) between 5 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);
create unique index if not exists email_signups_email_lower_idx on public.email_signups (lower(email));

create table if not exists public.download_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('installer','source','page_view')),
  created_at timestamptz not null default now()
);

alter table public.email_signups enable row level security;
alter table public.download_events enable row level security;

create policy "anon can sign up" on public.email_signups for insert to anon, authenticated with check (true);
create policy "anon can log events" on public.download_events for insert to anon, authenticated with check (true);

-- anon can only INSERT; rows are never readable through the public API
revoke all on public.email_signups, public.download_events from anon, authenticated;
grant insert on public.email_signups, public.download_events to anon, authenticated;

-- public aggregate counter without exposing rows
create or replace function public.get_download_count()
returns bigint language sql security definer set search_path = public stable as $$
  select count(*) from public.download_events where kind in ('installer','source');
$$;
revoke all on function public.get_download_count() from public;
grant execute on function public.get_download_count() to anon, authenticated;
