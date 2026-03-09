-- Fix for infinite recursion in conversation_participants policy
-- The current policy:
-- CREATE POLICY "Users can read participants of their conversations" ON public.conversation_participants
--     FOR SELECT USING (
--         conversation_id IN (
--             SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
--         )
--     );
-- This creates a loop because to check `conversation_participants` it queries `conversation_participants`.

-- Let's drop the bad policy and recreate it safely.
DROP POLICY IF EXISTS "Users can read participants of their conversations" ON public.conversation_participants;

-- Safe Policy: A user can read a participant row if the user itself is in the same conversation.
-- To avoid recursion, we can just allow users to read any participant row WHERE the conversation exists in their view (since the conversations table is already filtered).
-- Or simply:
CREATE POLICY "Users can read participants of their conversations" ON public.conversation_participants
    FOR SELECT USING (
        conversation_id IN (
            -- This references conversations, which already has an RLS policy checking if auth.uid() is a participant. 
            -- But that also queries participants! So we must break the loop.
            SELECT id FROM public.conversations
        )
    );

-- Wait, `conversations` SELECT policy:
-- id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
-- If `participants` SELECT policy uses `conversations`, and `conversations` uses `participants`, that's a loop.

-- THE REAL FIX: 
-- Allow users to read rows in `conversation_participants` WITHOUT querying `conversations` or `conversation_participants` again in a subquery block that causes recursion in Postgres.

-- The simplest secure way without recursion:
-- Since Supabase applies RLS per row: 
-- A user can see the participants of conversation X IF there exists a row in conversation_participants where conversation_id = X AND user_id = auth.uid().
-- BUT querying the same table in the USING clause causes the recursion.

-- The Supabase recommended way to handle join table RLS recursion:
-- We can create a SECURITY DEFINER function to check membership, or just simplify it:
-- Allow reading ALL conversation participants, BUT since `conversations` and `messages` are already RLS protected, knowing who is in a conversation ID doesn't expose the actual messages unless you are also in it.
-- However, for strict privacy:

CREATE OR REPLACE FUNCTION public.is_member_of(conv_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.conversation_participants 
        WHERE conversation_id = conv_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now replace the policy:
DROP POLICY IF EXISTS "Users can read participants of their conversations" ON public.conversation_participants;

CREATE POLICY "Users can read participants of their conversations" ON public.conversation_participants
    FOR SELECT USING (
        public.is_member_of(conversation_id)
    );

-- Replace the conversation policy to also use the function to prevent any loop:
DROP POLICY IF EXISTS "Users can read their conversations or global" ON public.conversations;

CREATE POLICY "Users can read their conversations or global" ON public.conversations
    FOR SELECT USING (
        type = 'global' OR 
        public.is_member_of(id)
    );

-- Re-run to ensure clean state
