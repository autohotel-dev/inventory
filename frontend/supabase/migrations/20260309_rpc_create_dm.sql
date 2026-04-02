-- Migration to add RPC for creating direct messages securely without RLS blocking the returning ID

CREATE OR REPLACE FUNCTION public.create_direct_message(user1_id UUID, user2_id UUID)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    -- 1. Create the conversation
    INSERT INTO public.conversations (type) 
    VALUES ('direct') 
    RETURNING id INTO v_conversation_id;

    -- 2. Add both participants
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES 
        (v_conversation_id, user1_id),
        (v_conversation_id, user2_id);

    -- 3. Return the new ID
    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- SECURITY DEFINER allows the function to bypass RLS policies temporarily 
-- so it can atomically create the room and add the users.
