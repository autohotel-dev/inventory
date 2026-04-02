-- Create the storage bucket for chat media files
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

-- Create policies for the bucket
-- Allow public reading of any file in the 'chat-media' bucket
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'chat-media' );

-- Allow authenticated users to upload files to the 'chat-media' bucket
create policy "Authenticated users can upload media"
  on storage.objects for insert
  with check (
    auth.role() = 'authenticated' AND
    bucket_id = 'chat-media'
  );

-- Allow users to delete their own uploaded files
create policy "Users can update their own media"
  on storage.objects for update
  using (
    auth.role() = 'authenticated' AND
    bucket_id = 'chat-media' AND
    owner = auth.uid()
  );

create policy "Users can delete their own media"
  on storage.objects for delete
  using (
    auth.role() = 'authenticated' AND
    bucket_id = 'chat-media' AND
    owner = auth.uid()
  );
