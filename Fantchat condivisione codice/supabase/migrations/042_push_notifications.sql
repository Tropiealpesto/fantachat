-- FantaChat - web push notifications

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now()
);

create index if not exists push_subscriptions_user_enabled_idx
on public.push_subscriptions(user_id, enabled);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_own_read on public.push_subscriptions;
create policy push_subscriptions_own_read
on public.push_subscriptions
for select
using (user_id = auth.uid());

drop policy if exists push_subscriptions_own_insert on public.push_subscriptions;
create policy push_subscriptions_own_insert
on public.push_subscriptions
for insert
with check (user_id = auth.uid());

drop policy if exists push_subscriptions_own_update on public.push_subscriptions;
create policy push_subscriptions_own_update
on public.push_subscriptions
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists push_subscriptions_own_delete on public.push_subscriptions;
create policy push_subscriptions_own_delete
on public.push_subscriptions
for delete
using (user_id = auth.uid());

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  title text not null,
  body text not null,
  url text not null default '/',
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  unique (user_id, event_key)
);

create index if not exists notification_deliveries_user_created_idx
on public.notification_deliveries(user_id, created_at desc);

alter table public.notification_deliveries enable row level security;

drop policy if exists notification_deliveries_own_read on public.notification_deliveries;
create policy notification_deliveries_own_read
on public.notification_deliveries
for select
using (user_id = auth.uid());

grant all privileges on public.push_subscriptions to service_role;
grant all privileges on public.notification_deliveries to service_role;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.notification_deliveries to authenticated;
