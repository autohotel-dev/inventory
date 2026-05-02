import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, useColorScheme, Platform, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { MessageCircle, ShieldAlert, LogOut, ChevronRight, Check, CheckCheck } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

function formatMessageTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);

    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `${diffMin} min`;
    if (diffHours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffHours < 48) return 'Ayer';
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

export default function InboxScreen() {
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const fetchConversations = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setCurrentUserId(user.id);

            const { data, error } = await supabase
                .from('conversations')
                .select(`
                    id, 
                    type, 
                    created_at,
                    updated_at,
                    participants:conversation_participants(user_id)
                `)
                .order('updated_at', { ascending: false });

            if (error || !data) throw error;
            
            // Recolectar user_ids de otros participantes para obtener sus nombres
            const otherUserIds = new Set<string>();
            data.forEach((conv: any) => {
                conv.participants?.forEach((p: any) => {
                    if (p.user_id !== user.id) {
                        otherUserIds.add(p.user_id);
                    }
                });
            });

            // Mapear nombres de usuarios
            let userNameMap = new Map<string, string>();
            if (otherUserIds.size > 0) {
                const { data: employees } = await supabase
                    .from('employees')
                    .select('auth_user_id, first_name, last_name')
                    .in('auth_user_id', Array.from(otherUserIds));

                if (employees) {
                    employees.forEach((emp: any) => {
                        const name = [emp.first_name, emp.last_name].filter(Boolean).join(' ');
                        if (name.trim()) {
                            userNameMap.set(emp.auth_user_id, name);
                        }
                    });
                }
            }

            // Obtener el último mensaje de cada conversación
            const convIds = data.map((c: any) => c.id);
            let lastMessageMap = new Map<string, any>();
            
            if (convIds.length > 0) {
                const { data: recentMessages } = await supabase
                    .from('messages')
                    .select('conversation_id, content, created_at, user_email, message_type, user_id')
                    .in('conversation_id', convIds)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false });

                if (recentMessages) {
                    recentMessages.forEach((msg: any) => {
                        if (!lastMessageMap.has(msg.conversation_id)) {
                            lastMessageMap.set(msg.conversation_id, msg);
                        }
                    });
                }
            }

            // Enriquecer datos
            const enriched = data.map((conv: any) => {
                const otherParticipant = conv.participants?.find((p: any) => p.user_id !== user.id);
                const otherUserId = otherParticipant?.user_id;
                const otherUserName = otherUserId ? userNameMap.get(otherUserId) : undefined;
                const lastMessage = lastMessageMap.get(conv.id);

                return {
                    ...conv,
                    last_message: lastMessage,
                    other_user_name: otherUserName,
                    other_user_id: otherUserId,
                    sort_time: lastMessage?.created_at || conv.updated_at
                };
            });

            enriched.sort((a, b) => new Date(b.sort_time).getTime() - new Date(a.sort_time).getTime());
            setConversations(enriched);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConversations();
        
        const channel = supabase.channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
                fetchConversations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchConversations]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.replace('/login');
    };

    const bgColors = isDark ? ['#09090b', '#000000'] as const : ['#f4f4f5', '#ffffff'] as const;

    if (loading) {
        return (
            <LinearGradient colors={bgColors} className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#e11d48" />
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={bgColors} className="flex-1">
            {/* Premium Background Orbs */}
            <View className="absolute top-[0%] left-[-20%] w-[80vw] h-[80vw] rounded-full bg-rose-500/10" style={{ filter: 'blur(60px)' }} pointerEvents="none" />
            <View className="absolute bottom-[10%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-rose-500/10" style={{ filter: 'blur(50px)' }} pointerEvents="none" />

            <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 20, paddingTop: Platform.OS === 'ios' ? 70 : 60, paddingBottom: 100 }}
                ListHeaderComponent={() => (
                    <Animated.View entering={FadeInDown.duration(600)} className="mb-6">
                        <View className="flex-row justify-between items-center mb-1">
                            <Text className={`text-[38px] font-black tracking-tighter ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                Inbox
                            </Text>
                            <TouchableOpacity onPress={handleLogout} className="w-10 h-10 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                                <LogOut size={18} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row items-center mt-1">
                            <View className="w-2 h-2 rounded-full bg-rose-500 mr-2 shadow-sm shadow-rose-500" />
                            <Text className={`text-[11px] font-black tracking-[0.2em] uppercase ${isDark ? 'text-rose-500' : 'text-rose-600'}`}>
                                Comunicaciones Activas
                            </Text>
                        </View>
                    </Animated.View>
                )}
                renderItem={({ item, index }) => {
                    const isGlobal = item.type === 'global';
                    const title = isGlobal ? 'Chat Global / Recepción' : (item.other_user_name || 'Personal Luxor');
                    const initial = title.charAt(0).toUpperCase();
                    
                    const lastMsg = item.last_message;
                    const isMyLastMsg = lastMsg?.user_id === currentUserId;
                    let rawContent = lastMsg?.content || '';
                    if (rawContent.startsWith('> Citando a')) {
                        const parts = rawContent.split('\n\n');
                        rawContent = parts.slice(1).join(' ').trim() || 'Respuesta';
                        rawContent = `↪ ${rawContent}`;
                    }

                    const previewText = lastMsg?.message_type === 'image' 
                        ? '📷 Imagen adjunta' 
                        : (rawContent || 'Toca para abrir la conversación');
                    
                    const timeText = lastMsg ? formatMessageTime(lastMsg.created_at) : '';

                    return (
                        <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
                            <TouchableOpacity 
                                onPress={() => router.push({ pathname: '/(chat)/room', params: { conversationId: item.id } })}
                                className="mb-3"
                            >
                                <BlurView 
                                    intensity={isDark ? 40 : 100} 
                                    tint={isDark ? "dark" : "light"} 
                                    className={`flex-row items-center p-4 rounded-[28px] border ${isDark ? 'border-zinc-700/50 bg-zinc-900/60' : 'border-white/60 bg-white/70'} overflow-hidden`}
                                    style={{
                                        shadowColor: isDark ? '#000' : '#e11d48',
                                        shadowOffset: { width: 0, height: 6 },
                                        shadowOpacity: isDark ? 0.3 : 0.08,
                                        shadowRadius: 12,
                                        elevation: 4
                                    }}
                                >
                                    <View className="relative">
                                        <View style={{ borderRadius: 28, overflow: 'hidden' }} className="shadow-lg shadow-rose-500/20">
                                            <LinearGradient 
                                                colors={isGlobal ? ['#3f3f46', '#18181b'] : ['#f43f5e', '#be123c']}
                                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                                className="w-14 h-14 items-center justify-center"
                                            >
                                                {isGlobal ? (
                                                    <ShieldAlert color="#fff" size={24} />
                                                ) : (
                                                    <Text className="text-white text-xl font-bold">{initial}</Text>
                                                )}
                                            </LinearGradient>
                                            <View className="absolute inset-0 rounded-full border-t border-white/30 border-l border-white/10" pointerEvents="none" />
                                        </View>
                                        <View className={`absolute bottom-0 right-0 w-[18px] h-[18px] bg-rose-500 rounded-full border-2 ${isDark ? 'border-zinc-900' : 'border-white'} items-center justify-center`}>
                                            <View className="w-2 h-2 rounded-full bg-white" />
                                        </View>
                                    </View>
                                    
                                    <View className="flex-1 ml-4 justify-center">
                                        <View className="flex-row justify-between items-center mb-1.5">
                                            <Text className={`text-[17px] font-black tracking-tight flex-1 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`} numberOfLines={1}>
                                                {title}
                                            </Text>
                                            {timeText ? (
                                                <Text className={`text-[11px] font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'} ml-2`}>
                                                    {timeText}
                                                </Text>
                                            ) : null}
                                        </View>
                                        
                                        <View className="flex-row items-center pr-2">
                                            {isMyLastMsg && lastMsg && (
                                                <CheckCheck size={16} color="#e11d48" className="mr-1.5" />
                                            )}
                                            <Text className={`text-[14px] font-medium leading-5 flex-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} numberOfLines={2}>
                                                {previewText}
                                            </Text>
                                        </View>
                                    </View>

                                    <View className="ml-3 pl-3 border-l border-zinc-500/20 justify-center self-stretch">
                                        <ChevronRight size={20} color={isDark ? '#52525b' : '#a1a1aa'} />
                                    </View>
                                </BlurView>
                            </TouchableOpacity>
                        </Animated.View>
                    );
                }}
                ListEmptyComponent={() => (
                    <Animated.View entering={FadeIn.duration(800)} className="items-center justify-center py-24">
                        <View className="w-24 h-24 rounded-full bg-zinc-500/10 items-center justify-center mb-6">
                            <MessageCircle size={36} color={isDark ? '#52525b' : '#a1a1aa'} />
                        </View>
                        <Text className={`text-xl font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Bandeja Vacía</Text>
                        <Text className={`text-center mt-2 font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            No hay mensajes en tu buzón.
                        </Text>
                    </Animated.View>
                )}
            />
        </LinearGradient>
    );
}
