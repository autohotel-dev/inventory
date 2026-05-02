import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, useColorScheme, Keyboard, Modal, Alert, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Send, Image as ImageIcon, X, Edit2, Trash2, Reply, Check, CheckCheck } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown, Layout, SlideInDown, SlideOutDown } from 'react-native-reanimated';

const PAGE_SIZE = 15;

export default function RoomScreen() {
    const { conversationId } = useLocalSearchParams();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);
    
    // Pagination states
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // States for interactibility
    const [editingMsg, setEditingMsg] = useState<any>(null);
    const [replyingMsg, setReplyingMsg] = useState<any>(null);
    const [selectedMsg, setSelectedMsg] = useState<any>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    
    // Typing indicators
    const [typingUsers, setTypingUsers] = useState<any[]>([]);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const isDark = useColorScheme() === 'dark';
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);

    // Manual Keyboard Handling for Android Edge-to-Edge
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
            setKeyboardHeight(e.endCoordinates.height);
        });
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const fetchMessages = useCallback(async (from = 0, to = PAGE_SIZE - 1, isLoadMore = false) => {
        if (isLoadMore) setLoadingMore(true);
        
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (!error && data) {
            if (data.length < PAGE_SIZE) {
                setHasMore(false);
            }
            if (isLoadMore) {
                setMessages(prev => [...prev, ...data]);
            } else {
                setMessages(data);
            }
        }
        
        if (isLoadMore) setLoadingMore(false);
        else setInitialLoading(false);
    }, [conversationId]);

    useEffect(() => {
        let channel: any;

        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
            await fetchMessages();

            if (user) {
                channel = supabase.channel(`room:${conversationId}`)
                    .on('postgres_changes', { 
                        event: '*', 
                        schema: 'public', 
                        table: 'messages',
                        filter: `conversation_id=eq.${conversationId}`
                    }, payload => {
                        if (payload.eventType === 'INSERT') {
                            setMessages(prev => [payload.new, ...prev]);
                            if (payload.new.user_id !== user.id) {
                                supabase.from('messages')
                                    .update({ is_read: true })
                                    .eq('id', payload.new.id)
                                    .then();
                            }
                        } else if (payload.eventType === 'UPDATE') {
                            setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
                        }
                    })
                    .on('broadcast', { event: 'typing' }, payload => {
                        if (payload.payload.user_id !== user.id) {
                            setTypingUsers(prev => {
                                const filtered = prev.filter(u => u.user_id !== payload.payload.user_id);
                                return [...filtered, payload.payload];
                            });
                            setTimeout(() => {
                                setTypingUsers(prev => prev.filter(u => u.user_id !== payload.payload.user_id));
                            }, 3000);
                        }
                    })
                    .subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            supabase.from('messages')
                                .update({ is_read: true })
                                .eq('conversation_id', conversationId)
                                .neq('user_id', user.id)
                                .eq('is_read', false)
                                .then();
                        }
                    });
            }
        };

        setup();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [conversationId, fetchMessages]);

    const handleLoadMore = () => {
        if (!hasMore || loadingMore || initialLoading) return;
        fetchMessages(messages.length, messages.length + PAGE_SIZE - 1, true);
    };

    const handleTyping = (text: string) => {
        setNewMessage(text);
        if (!currentUser) return;
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        
        supabase.channel(`room:${conversationId}`).send({
            type: 'broadcast',
            event: 'typing',
            payload: { user_id: currentUser.id, user_email: currentUser.email }
        });
        
        typingTimeoutRef.current = setTimeout(() => {}, 2000);
    };

    const handleSend = async () => {
        if (!newMessage.trim() || !currentUser) return;
        const content = newMessage.trim();

        if (editingMsg) {
            // Edit flow
            setNewMessage('');
            const currentEditId = editingMsg.id;
            setEditingMsg(null);
            Keyboard.dismiss();

            const { error } = await supabase
                .from('messages')
                .update({ content, is_edited: true, updated_at: new Date().toISOString() })
                .eq('id', currentEditId);

            if (error) console.error('Error editing message:', error);
        } else {
            // Insert flow
            let finalContent = content;
            if (replyingMsg) {
                const author = replyingMsg.user_id === currentUser.id ? 'Tú' : (replyingMsg.user_email?.split('@')[0] || 'Staff');
                finalContent = `> Citando a ${author}:\n> "${replyingMsg.content}"\n\n${content}`;
            }

            setNewMessage('');
            setReplyingMsg(null);

            const { error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    user_id: currentUser.id,
                    user_email: currentUser.email,
                    content: finalContent,
                    message_type: 'text'
                });

            if (error) console.error('Error sending message:', error);
        }
    };

    const handleImagePick = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled && result.assets[0] && currentUser) {
            setUploadingImage(true);
            try {
                const uri = result.assets[0].uri;
                const ext = uri.substring(uri.lastIndexOf('.') + 1) || 'jpg';
                const fileName = `${currentUser.id}/${Date.now()}.${ext}`;
                
                const response = await fetch(uri);
                const blob = await response.blob();
                
                const { error: uploadError } = await supabase.storage
                    .from('chat-attachments')
                    .upload(fileName, blob, { contentType: `image/${ext}` });
                    
                if (uploadError) throw uploadError;
                
                const { data: publicUrlData } = supabase.storage
                    .from('chat-attachments')
                    .getPublicUrl(fileName);
                    
                await supabase.from('messages').insert({
                    conversation_id: conversationId,
                    user_id: currentUser.id,
                    user_email: currentUser.email,
                    content: '📷 Imagen adjunta',
                    media_url: publicUrlData.publicUrl,
                    message_type: 'image'
                });
                
            } catch (e) {
                console.error('Error uploading image', e);
                Alert.alert('Error', 'No se pudo subir la imagen.');
            } finally {
                setUploadingImage(false);
            }
        }
    };

    const handleDelete = async (msgId: string) => {
        Alert.alert(
            "Eliminar mensaje",
            "¿Estás seguro de eliminar este mensaje para todos?",
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Eliminar", 
                    style: "destructive",
                    onPress: async () => {
                        setSelectedMsg(null);
                        await supabase
                            .from('messages')
                            .update({ deleted_at: new Date().toISOString() })
                            .eq('id', msgId);
                    }
                }
            ]
        );
    };

    const bgColors = isDark ? ['#09090b', '#000000'] as const : ['#fafafa', '#f4f4f5'] as const;

    const renderMessage = ({ item }: { item: any }) => {
        const isMe = item.user_id === currentUser?.id;
        const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isDeleted = !!item.deleted_at;

        let contentElement;
        if (isDeleted) {
            contentElement = <Text className={`italic ${isMe ? 'text-white/60' : (isDark ? 'text-zinc-500' : 'text-zinc-400')}`}>🚫 Este mensaje fue eliminado</Text>;
        } else if (item.message_type === 'image' && item.media_url) {
            contentElement = (
                <View className="mb-1">
                    <Image 
                        source={{ uri: item.media_url }} 
                        className="w-[220px] h-[220px] rounded-[18px]" 
                        resizeMode="cover"
                    />
                </View>
            );
        } else if (item.content.startsWith('> Citando a')) {
            const parts = item.content.split('\n\n');
            const quoteText = parts[0];
            const actualReply = parts.slice(1).join('\n\n');

            let author = 'Usuario';
            let msg = quoteText;
            
            const lines = quoteText.split('\n');
            if (lines.length >= 2) {
                author = lines[0].replace('> Citando a ', '').replace(':', '').trim();
                msg = lines.slice(1).join('\n').replace(/^>\s?"?/, '').replace(/"?$/, '').trim();
            }

            contentElement = (
                <View>
                    <View className={`border-l-[3px] pl-3 mb-2.5 ${isMe ? 'border-white/60 bg-black/15' : 'border-rose-500 bg-rose-500/10'} rounded-lg py-2 pr-3`}>
                        <Text className={`text-[12px] font-black tracking-tight mb-0.5 ${isMe ? 'text-white' : 'text-rose-600'}`}>
                            {author}
                        </Text>
                        <Text className={`text-[13px] leading-[18px] ${isMe ? 'text-white/80' : (isDark ? 'text-zinc-400' : 'text-zinc-600')}`} numberOfLines={3}>
                            {msg}
                        </Text>
                    </View>
                    <Text className={`text-[15px] leading-5 font-medium ${isMe ? 'text-white' : (isDark ? 'text-zinc-100' : 'text-zinc-800')}`} style={isMe ? { textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 } : {}}>
                        {actualReply}
                    </Text>
                </View>
            );
        } else {
            contentElement = <Text className={`text-[15px] leading-5 font-medium ${isMe ? 'text-white' : (isDark ? 'text-zinc-100' : 'text-zinc-800')}`} style={isMe ? { textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 } : {}}>{item.content}</Text>;
        }

        if (isMe) {
            return (
                <Animated.View layout={Layout.springify()} entering={FadeInDown.springify()} className="self-end max-w-[80%] my-1 mx-3">
                    <TouchableOpacity 
                        activeOpacity={0.7} 
                        onLongPress={() => !isDeleted && setSelectedMsg(item)}
                        style={{
                            shadowColor: '#e11d48',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.25,
                            shadowRadius: 12,
                            elevation: 5
                        }}
                    >
                        <View style={{ borderRadius: 24, overflow: 'hidden' }}>
                            <LinearGradient 
                                colors={isDeleted ? ['#3f3f46', '#27272a'] : ['#f43f5e', '#be123c']} 
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                className="p-3 px-5"
                            >
                                {contentElement}
                                <View className="flex-row items-center justify-end mt-1 gap-1 opacity-90">
                                    {item.is_edited && !isDeleted && <Text className="text-[10px] text-white/70 italic mr-1">(editado)</Text>}
                                    <Text className="text-[10px] text-white/90 font-bold tracking-wider">{timeStr}</Text>
                                    {!isDeleted && <CheckCheck size={14} color={item.is_read ? "#38bdf8" : "#fecdd3"} strokeWidth={2.5} />}
                                </View>
                            </LinearGradient>
                            {/* Rim Light Premium Glass Effect */}
                            {!isDeleted && (
                                <View className="absolute inset-0 rounded-[24px] border-t border-white/30 border-l border-white/10" pointerEvents="none" />
                            )}
                        </View>
                    </TouchableOpacity>
                </Animated.View>
            );
        }

        return (
            <Animated.View layout={Layout.springify()} entering={FadeInDown.springify()} className="self-start max-w-[80%] my-1 mx-3">
                <TouchableOpacity activeOpacity={0.7} onLongPress={() => !isDeleted && setSelectedMsg(item)}>
                    <View className="flex-row items-end">
                        <View 
                            style={{ 
                                borderRadius: 24,
                                shadowColor: isDark ? '#000' : '#e11d48',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: isDark ? 0.3 : 0.05,
                                shadowRadius: 8,
                                elevation: 3
                            }} 
                            className={`p-3.5 px-5 border ${isDark ? 'bg-zinc-800/90 border-zinc-700/50' : 'bg-white border-rose-500/10'}`}
                        >
                            {!isDeleted && (
                                <Text className={`text-[11px] font-black uppercase tracking-widest mb-1.5 ${isDark ? 'text-zinc-500' : 'text-rose-600'}`}>
                                    {item.user_email?.split('@')[0] || 'Staff'}
                                </Text>
                            )}
                            {contentElement}
                            <View className="flex-row items-center justify-start mt-1.5 gap-1 opacity-70">
                                <Text className={`text-[10px] font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{timeStr}</Text>
                                {item.is_edited && !isDeleted && <Text className={`text-[10px] italic ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>(editado)</Text>}
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
    const wrapperProps = Platform.OS === 'ios' 
        ? { behavior: "padding" as const, keyboardVerticalOffset: 90, className: "flex-1" }
        : { className: "flex-1" };

    return (
        <KeyboardWrapper {...wrapperProps}>
            <LinearGradient colors={bgColors} className="flex-1">
                {/* Premium Background Orbs */}
                <View className="absolute top-[10%] left-[-20%] w-[80vw] h-[80vw] rounded-full bg-rose-500/10" style={{ filter: 'blur(60px)' }} pointerEvents="none" />
                <View className="absolute bottom-[30%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-rose-500/5" style={{ filter: 'blur(50px)' }} pointerEvents="none" />

                {initialLoading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color="#e11d48" />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={item => item.id}
                        renderItem={renderMessage}
                        inverted={true}
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={() => loadingMore ? (
                            <View className="py-4 items-center justify-center">
                                <ActivityIndicator size="small" color="#e11d48" />
                            </View>
                        ) : null}
                        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 20 }}
                    />
                )}

                {/* Input Area */}
                <Animated.View style={{ paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0 }}>
                    <BlurView intensity={isDark ? 30 : 80} tint={isDark ? "dark" : "light"} className={`border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                        
                        {typingUsers.length > 0 && (
                            <Animated.View entering={FadeInDown} className="absolute -top-7 left-6 z-10 px-3 py-1 rounded-full bg-rose-500/90 border border-rose-500 shadow-sm flex-row items-center gap-1.5">
                                <ActivityIndicator size="small" color="white" style={{ transform: [{ scale: 0.6 }] }} />
                                <Text className="text-[10px] text-white font-bold tracking-widest uppercase">
                                    {typingUsers[0].user_email.split('@')[0]} escribiendo
                                </Text>
                            </Animated.View>
                        )}
                        
                        {/* Reply / Edit Indicator */}
                    {(replyingMsg || editingMsg) && (
                        <Animated.View entering={SlideInDown.duration(200)} exiting={SlideOutDown.duration(200)} className="flex-row items-center px-4 pt-3 pb-1 justify-between">
                            <View className="flex-1 border-l-4 border-rose-500 pl-3">
                                <Text className={`text-xs font-bold ${isDark ? 'text-rose-500' : 'text-rose-600'}`}>
                                    {editingMsg ? 'Editando mensaje' : `Respondiendo a ${replyingMsg?.user_email?.split('@')[0]}`}
                                </Text>
                                <Text className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} numberOfLines={1}>
                                    {editingMsg ? editingMsg.content : replyingMsg.content}
                                </Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => { setReplyingMsg(null); setEditingMsg(null); setNewMessage(''); }}
                                className="w-8 h-8 items-center justify-center bg-zinc-500/10 rounded-full"
                            >
                                <X size={16} color={isDark ? '#a1a1aa' : '#71717a'} />
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    <View className="flex-row items-end p-3 pt-2 pb-6 gap-3">
                        <TouchableOpacity 
                            onPress={handleImagePick}
                            disabled={uploadingImage}
                            className={`w-12 h-12 rounded-full items-center justify-center border ${isDark ? 'bg-zinc-800 border-zinc-700/50' : 'bg-white border-zinc-200/50'} shadow-sm`}
                        >
                            {uploadingImage ? <ActivityIndicator size="small" color="#e11d48" /> : <ImageIcon color={isDark ? '#a1a1aa' : '#71717a'} size={20} />}
                        </TouchableOpacity>
                        
                        <View className={`flex-1 min-h-[48px] max-h-32 rounded-[24px] border flex-row items-center px-2 ${isDark ? 'bg-zinc-800/90 border-zinc-700/50' : 'bg-white/90 border-zinc-200/50'} shadow-sm`}>
                            <TextInput
                                ref={inputRef}
                                value={newMessage}
                                onChangeText={handleTyping}
                                placeholder="Escribe un mensaje..."
                                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                                className={`flex-1 min-h-[48px] py-3 px-3 text-[15px] font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}
                                multiline
                            />
                        </View>

                        <TouchableOpacity 
                            onPress={handleSend}
                            disabled={!newMessage.trim()}
                            className="w-12 h-12 rounded-full overflow-hidden shadow-sm"
                        >
                            <LinearGradient 
                                colors={newMessage.trim() ? ['#e11d48', '#be123c'] : (isDark ? ['#27272a', '#18181b'] : ['#e4e4e7', '#d4d4d8'])} 
                                className="flex-1 items-center justify-center"
                            >
                                {editingMsg ? (
                                    <Check color={newMessage.trim() ? '#fff' : (isDark ? '#52525b' : '#a1a1aa')} size={20} />
                                ) : (
                                    <Send color={newMessage.trim() ? '#fff' : (isDark ? '#52525b' : '#a1a1aa')} size={18} />
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </BlurView>
                </Animated.View>
            </LinearGradient>

            {/* Custom Bottom Sheet Modal for Message Actions */}
            <Modal
                visible={!!selectedMsg}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedMsg(null)}
            >
                <View className="flex-1 justify-end bg-black/60">
                    <TouchableOpacity 
                        activeOpacity={1} 
                        className="absolute inset-0" 
                        onPress={() => setSelectedMsg(null)} 
                    />
                    <Animated.View entering={SlideInDown.duration(250)} className={`p-6 pb-12 rounded-t-[36px] ${isDark ? 'bg-zinc-900' : 'bg-white'} border-t border-zinc-500/20 shadow-2xl`}>
                        <View className="w-12 h-1.5 bg-zinc-500/30 rounded-full self-center mb-6" />
                        
                        <View className="gap-2">
                            <TouchableOpacity 
                                className={`flex-row items-center p-4 rounded-2xl ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}
                                onPress={() => {
                                    setReplyingMsg(selectedMsg);
                                    setSelectedMsg(null);
                                    inputRef.current?.focus();
                                }}
                            >
                                <Reply size={22} color={isDark ? '#fb7185' : '#e11d48'} />
                                <Text className={`text-lg font-semibold ml-4 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Responder</Text>
                            </TouchableOpacity>

                            {selectedMsg?.user_id === currentUser?.id && (
                                <>
                                    <TouchableOpacity 
                                        className={`flex-row items-center p-4 rounded-2xl ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}
                                        onPress={() => {
                                            let pureContent = selectedMsg.content;
                                            if (pureContent.startsWith('> Citando a')) {
                                                const parts = pureContent.split('\n\n');
                                                pureContent = parts.slice(1).join('\n\n');
                                            }
                                            setEditingMsg(selectedMsg);
                                            setNewMessage(pureContent);
                                            setSelectedMsg(null);
                                            inputRef.current?.focus();
                                        }}
                                    >
                                        <Edit2 size={22} color={isDark ? '#38bdf8' : '#0284c7'} />
                                        <Text className={`text-lg font-semibold ml-4 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Editar mensaje</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        className="flex-row items-center p-4 rounded-2xl bg-red-500/10"
                                        onPress={() => handleDelete(selectedMsg.id)}
                                    >
                                        <Trash2 size={22} color="#ef4444" />
                                        <Text className="text-lg font-semibold ml-4 text-red-500">Eliminar mensaje</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </KeyboardWrapper>
    );
}
