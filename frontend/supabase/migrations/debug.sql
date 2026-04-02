-- RLS policy fix for creating a conversation and inserting participants

-- 1. In `startDirectConversation`, we do:
--    const { data: newConv } = await supabase.from('conversations').insert([{ type: 'direct' }]).select().single();
-- The policy "Users can create conversations" allows INSERT with CHECK (auth.role() = 'authenticated').
-- However, we also SELECT the inserted row. If the SELECT policy fails, it returns null.
-- The CURRENT SELECT policy is:
-- CREATE POLICY "Users can read their conversations or global" ON public.conversations
--     FOR SELECT USING (
--         type = 'global' OR 
--         id IN (
--             SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
--         )
--     );
-- 
-- So when you INSERT a conversation, the user is NOT YET a participant, so the SELECT after the INSERT fails!

-- We need a policy to allow a user to SELECT a conversation they just created, or we can just simplify it: allow authenticated users to SELECT all conversations? No, that breaks privacy.
-- Alternative: Since `type = 'direct'` conversations are useless without participants, the insert should be atomic (via RPC), OR we loosen the SELECT policy slightly.

-- Let's change `useConversations.ts` to NOT use `.select().single()` or we can create an RPC to start a conversation safely.
