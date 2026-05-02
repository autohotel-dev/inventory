-- 1. Create push_tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, token)
);

-- Enable RLS on push_tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON push_tokens;
CREATE POLICY "Users can manage their own push tokens"
    ON push_tokens FOR ALL
    USING (auth.uid() = user_id);

-- 2. Add is_read to messages (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_read') THEN
        ALTER TABLE messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Create chat-attachments storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for chat-attachments
DROP POLICY IF EXISTS "Public can view chat attachments" ON storage.objects;
CREATE POLICY "Public can view chat attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat attachments"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

