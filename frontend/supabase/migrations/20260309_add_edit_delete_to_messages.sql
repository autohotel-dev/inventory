-- Add edit and delete support to messages table
alter table public.messages 
add column if not exists is_edited boolean default false,
add column if not exists deleted_at timestamp with time zone;

-- Update RLS policies to allow users to update/soft-delete their own messages
create policy "Users can update their own messages" 
on public.messages 
for update 
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Admins can update any message" 
on public.messages 
for update 
using (
    exists (
        select 1 from public.employees 
        where user_id = auth.uid() 
        and role = 'admin'
    )
);
