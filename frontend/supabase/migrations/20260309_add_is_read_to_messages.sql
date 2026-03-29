-- Add is_read column to messages table
alter table public.messages 
add column if not exists is_read boolean default false;

-- Allow authenticated users to update messages (specifically for marking as read)
create policy "Anyone can update messages"
  on public.messages for update
  using ( auth.role() = 'authenticated' )
  with check ( auth.role() = 'authenticated' );
