-- Create chat_subscriptions table
create table if not exists public.chat_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure unique subscription per endpoint mechanism
  unique(endpoint)
);

-- Enable RLS
alter table public.chat_subscriptions enable row level security;

-- Policies
create policy "Users can insert their own subscriptions"
  on public.chat_subscriptions for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own subscriptions"
  on public.chat_subscriptions for update
  using ( auth.uid() = user_id );

create policy "Users can delete their own subscriptions"
  on public.chat_subscriptions for delete
  using ( auth.uid() = user_id );

-- Admin can view all (for debugging or dashboard if needed), user sees own
create policy "Users can view own subscriptions"
  on public.chat_subscriptions for select
  using ( auth.uid() = user_id );

-- Index for faster lookups when sending notifications
create index if not exists idx_chat_subscriptions_user on public.chat_subscriptions(user_id);
