-- 1. Create conversations table
CREATE TABLE public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'global')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Policy for inserting conversations (any auth user can start one)
CREATE POLICY "Users can create conversations" ON public.conversations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 2. Create conversation_participants table
CREATE TABLE public.conversation_participants (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
);

-- Enable RLS on participants
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Policy for reading conversations (needs participants table to exist first)
CREATE POLICY "Users can read their conversations or global" ON public.conversations
    FOR SELECT USING (
        type = 'global' OR 
        id IN (
            SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
        )
    );

-- Policy for reading participants
CREATE POLICY "Users can read participants of their conversations" ON public.conversation_participants
    FOR SELECT USING (
        conversation_id IN (
            SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
        )
    );

-- Policy for inserting participants
CREATE POLICY "Users can add participants" ON public.conversation_participants
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. Modify messages table
ALTER TABLE public.messages ADD COLUMN conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;

-- Insert a default global conversation
DO $$
DECLARE
    v_global_id UUID;
BEGIN
    INSERT INTO public.conversations (type) VALUES ('global') RETURNING id INTO v_global_id;
    -- Assign all current messages to this global conversation
    UPDATE public.messages SET conversation_id = v_global_id WHERE conversation_id IS NULL;
END $$;

-- Make it NOT NULL moving forward
ALTER TABLE public.messages ALTER COLUMN conversation_id SET NOT NULL;

-- 4. Re-create messages policies to respect conversation privacy
DROP POLICY IF EXISTS "Anyone can read messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.messages;

-- A user can read a message if it's in a global conversation, or if they are a participant
CREATE POLICY "Users can read conversation messages" ON public.messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT id FROM public.conversations WHERE type = 'global'
            UNION
            SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
        )
    );

-- A user can insert a message if they are a participant or it's global
CREATE POLICY "Users can insert conversation messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND
        conversation_id IN (
            SELECT id FROM public.conversations WHERE type = 'global'
            UNION
            SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
        )
    );
