-- Create messages table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  user_id uuid references auth.users(id) not null,
  user_email text, -- Cached for display purposes to avoid complex joins
  is_admin boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.messages enable row level security;

-- Policies
create policy "Anyone can read messages"
  on public.messages for select
  using ( auth.role() = 'authenticated' );

create policy "Anyone can insert messages"
  on public.messages for insert
  with check ( auth.role() = 'authenticated' );

-- Realtime
alter publication supabase_realtime add table public.messages;
