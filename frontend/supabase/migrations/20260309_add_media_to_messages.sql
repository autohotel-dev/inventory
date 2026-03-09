-- Add media columns to messages table
alter table public.messages 
add column if not exists media_url text,
add column if not exists message_type text default 'text';

-- Ensure message_type has a check constraint for valid types
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'messages_message_type_check') then
        alter table public.messages 
        add constraint messages_message_type_check 
        check (message_type in ('text', 'image'));
    end if;
end $$;
