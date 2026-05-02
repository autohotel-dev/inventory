import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { MessageCircle, ShieldAlert, User, LogOut } from 'lucide-react-native';

export default function InboxScreen() {
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';

    useEffect(() => {
        fetchConversations();
        
        // Suscribirse a cambios en mensajes para actualizar la lista
        const channel = supabase.channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                fetchConversations(); // Recargar lista al haber nuevo mensaje
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchConversations = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Obtener conversaciones donde el usuario es participante o es global
            const { data, error } = await supabase
                .from('conversations')
                .select(`
                    id, 
                    type, 
                    created_at,
                    updated_at,
                    conversation_participants!inner(user_id)
                `)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            
            // Para simplificar en este demo, mostraremos el Chat Global primero
            // y luego los privados donde el admin sea participe
            let filtered = data;
            
            // Re-ordenar (Global primero si es requerido, o solo por fecha)
            filtered = filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
            
            setConversations(filtered);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.replace('/login');
    };

    if (loading) {
        return (
            <View className={`flex-1 justify-center items-center ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
                <ActivityIndicator size="large" color="#10b981" />
            </View>
        );
    }

    return (
        <View className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
            <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                ListHeaderComponent={() => (
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Tus Conversaciones</Text>
                        <TouchableOpacity onPress={handleLogout} className="p-2 bg-red-500/10 rounded-full">
                            <LogOut size={20} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                )}
                renderItem={({ item }) => {
                    const isGlobal = item.type === 'global';
                    return (
                        <TouchableOpacity 
                            onPress={() => router.push({ pathname: '/(chat)/room', params: { conversationId: item.id, type: item.type } })}
                            className={`flex-row items-center p-4 mb-3 rounded-2xl shadow-sm ${isDark ? 'bg-zinc-900' : 'bg-white'}`}
                        >
                            <View className={`w-14 h-14 rounded-full items-center justify-center mr-4 ${isGlobal ? 'bg-zinc-800' : 'bg-emerald-500/10'}`}>
                                {isGlobal ? <ShieldAlert color="#fff" size={24} /> : <User color="#10b981" size={24} />}
                            </View>
                            <View className="flex-1">
                                <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                    {isGlobal ? 'Chat Global / Soporte' : 'Conversación Privada'}
                                </Text>
                                <Text className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} numberOfLines={1}>
                                    Toca para ver los mensajes...
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={() => (
                    <View className="items-center justify-center py-20 opacity-50">
                        <MessageCircle size={64} color={isDark ? '#fff' : '#000'} className="mb-4" />
                        <Text className={`text-center ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>No hay conversaciones aún</Text>
                    </View>
                )}
            />
        </View>
    );
}
