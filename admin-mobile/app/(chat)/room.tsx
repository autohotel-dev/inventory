import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, useColorScheme } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Send, Image as ImageIcon } from 'lucide-react-native';

export default function RoomScreen() {
    const { conversationId, type } = useLocalSearchParams();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);
    const isDark = useColorScheme() === 'dark';
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
            await fetchMessages();
        };

        setup();

        const channel = supabase.channel(`room:${conversationId}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            }, payload => {
                setMessages(prev => [...prev, payload.new]);
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId]);

    const fetchMessages = async () => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (!error && data) {
            setMessages(data);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
        }
    };

    const handleSend = async () => {
        if (!newMessage.trim() || !currentUser) return;

        const content = newMessage.trim();
        setNewMessage(''); // optimistic clear

        const { error } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                user_id: currentUser.id,
                user_email: currentUser.email,
                content: content,
                message_type: 'text'
            });

        if (error) {
            console.error('Error sending message:', error);
            // Optionally revert UI state
        }
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isMe = item.user_id === currentUser?.id;

        return (
            <View className={`max-w-[80%] my-1 mx-4 p-3 rounded-2xl ${isMe ? 'self-end rounded-tr-sm bg-emerald-600' : `self-start rounded-tl-sm ${isDark ? 'bg-zinc-800' : 'bg-white border border-zinc-200'}`}`}>
                {!isMe && (
                    <Text className={`text-[10px] font-bold mb-1 opacity-70 ${isDark ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {item.user_email?.split('@')[0] || 'Usuario'}
                    </Text>
                )}
                <Text className={`text-base ${isMe || isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {item.content}
                </Text>
                <Text className={`text-[9px] mt-1 text-right ${isMe || isDark ? 'text-white/50' : 'text-zinc-400'}`}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}
        >
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderMessage}
                contentContainerStyle={{ paddingVertical: 10 }}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            <View className={`p-4 border-t flex-row items-center gap-2 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                <TouchableOpacity className="p-2">
                    <ImageIcon color={isDark ? '#a1a1aa' : '#71717a'} size={24} />
                </TouchableOpacity>
                <TextInput
                    value={newMessage}
                    onChangeText={setNewMessage}
                    placeholder="Escribe un mensaje..."
                    placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
                    className={`flex-1 min-h-[44px] max-h-32 px-4 py-2.5 rounded-full text-base ${isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'}`}
                    multiline
                />
                <TouchableOpacity 
                    onPress={handleSend}
                    disabled={!newMessage.trim()}
                    className={`w-11 h-11 rounded-full items-center justify-center ${newMessage.trim() ? 'bg-emerald-500' : isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}
                >
                    <Send color={newMessage.trim() ? '#fff' : (isDark ? '#52525b' : '#a1a1aa')} size={20} />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}
