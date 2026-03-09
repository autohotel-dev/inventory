-- Function to override is_admin and user_email on message insert
create or replace function public.set_message_metadata()
returns trigger as $$
declare
  user_email_val text;
  user_role_val text;
  user_is_admin_val boolean;
begin
  -- Force user_id to be the authenticated user
  new.user_id := auth.uid();
  
  -- 1. Try to get details from public.employees
  select email, role into user_email_val, user_role_val
  from public.employees
  where auth_user_id = new.user_id;

  -- 2. Determine admin status
  if user_role_val is not null and user_role_val in ('admin', 'manager', 'gerente') then
    user_is_admin_val := true;
  else
    user_is_admin_val := false;
  end if;

  -- 3. If email not found in employees, try auth.users (fallback for guests/others)
  if user_email_val is null then
     select email into user_email_val
     from auth.users
     where id = new.user_id;
  end if;

  -- Fallback if still null
  if user_email_val is null then
     user_email_val := 'unknown';
  end if;

  -- Set secure values
  new.is_admin := user_is_admin_val;
  new.user_email := user_email_val;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger to enforce admin flag and user_id on messages
drop trigger if exists on_message_insert on public.messages;
create trigger on_message_insert
  before insert on public.messages
  for each row execute procedure public.set_message_metadata();
