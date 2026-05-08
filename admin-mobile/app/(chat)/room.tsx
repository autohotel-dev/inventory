import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, useColorScheme, Keyboard, Modal, Alert, ActivityIndicator, Image, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Send, Image as ImageIcon, X, Edit2, Trash2, Reply, Check, CheckCheck, Mic, Square, Search, Pin, PinOff, FileText, Headphones, Paperclip } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { decode } from 'base64-arraybuffer';
import Animated, { FadeInDown, Layout, SlideInDown, SlideOutDown, FadeIn } from 'react-native-reanimated';

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
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isDark = useColorScheme() === 'dark';
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);

    // Voice recording
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Search
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Quick reactions
    const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

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
            .select('*, reply_to:reply_to_id(id, content, user_email, message_type)')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (!error && data) {
            if (data.length < PAGE_SIZE) {
                setHasMore(false);
            }

            // Fetch reactions for these messages
            const msgIds = data.map((m: any) => m.id);
            let reactionsMap: Record<string, any[]> = {};
            if (msgIds.length > 0) {
                const { data: reactions } = await supabase
                    .from('message_reactions')
                    .select('*')
                    .in('message_id', msgIds);
                if (reactions) {
                    reactions.forEach((r: any) => {
                        if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
                        reactionsMap[r.message_id].push(r);
                    });
                }
            }

            const enriched = data.map((m: any) => ({ ...m, reactions: reactionsMap[m.id] || [] }));

            if (isLoadMore) {
                setMessages(prev => [...prev, ...enriched]);
            } else {
                setMessages(enriched);
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
            const replyId = replyingMsg?.id || null;
            setNewMessage('');
            setReplyingMsg(null);

            const insertPayload: any = {
                conversation_id: conversationId,
                user_id: currentUser.id,
                user_email: currentUser.email,
                content,
                message_type: 'text'
            };
            if (replyId) insertPayload.reply_to_id = replyId;

            const { error } = await supabase
                .from('messages')
                .insert(insertPayload);

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
                const fileName = `chat/${Date.now()}.${ext}`;
                
                const base64Img = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
                const arrayBufferImg = decode(base64Img);
                
                const { error: uploadError } = await supabase.storage
                    .from('chat-media')
                    .upload(fileName, arrayBufferImg, { contentType: `image/${ext}`, upsert: true });
                    
                if (uploadError) throw uploadError;
                
                const { data: publicUrlData } = supabase.storage
                    .from('chat-media')
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

    // Document picker
    const handleDocumentPick = async () => {
        if (!currentUser) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv'],
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets?.[0]) return;

            setUploadingImage(true);
            const asset = result.assets[0];
            const ext = asset.name.split('.').pop() || 'pdf';
            const fileName = `chat/${Date.now()}.${ext}`;

            const base64Doc = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
            const arrayBufferDoc = decode(base64Doc);

            const { error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(fileName, arrayBufferDoc, { contentType: asset.mimeType || 'application/octet-stream', upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('chat-media')
                .getPublicUrl(fileName);

            await supabase.from('messages').insert({
                conversation_id: conversationId,
                user_id: currentUser.id,
                user_email: currentUser.email,
                content: `📎 ${asset.name}`,
                media_url: publicUrlData.publicUrl,
                message_type: 'file'
            });
        } catch (e) {
            console.error('Error uploading document', e);
            Alert.alert('Error', 'No se pudo subir el documento.');
        } finally {
            setUploadingImage(false);
        }
    };

    // Voice recording
    const startRecording = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Se necesita acceso al micrófono.');
                return;
            }
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            recordingRef.current = recording;
            setIsRecording(true);
            setRecordingTime(0);
            recordingTimerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
        } catch (e) {
            console.error('Error starting recording', e);
            Alert.alert('Error', 'No se pudo iniciar la grabación.');
        }
    };

    const stopRecording = async () => {
        if (!recordingRef.current || !currentUser) return;
        setIsRecording(false);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

        try {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            recordingRef.current = null;
            if (!uri) return;

            setUploadingImage(true);
            const fileName = `chat/voice-${Date.now()}.m4a`;
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
            const arrayBuffer = decode(base64);

            const { error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(fileName, arrayBuffer, { contentType: 'audio/mp4', upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('chat-media')
                .getPublicUrl(fileName);

            await supabase.from('messages').insert({
                conversation_id: conversationId,
                user_id: currentUser.id,
                user_email: currentUser.email,
                content: `🎤 Nota de voz (${recordingTime}s)`,
                media_url: publicUrlData.publicUrl,
                message_type: 'audio'
            });
        } catch (e) {
            console.error('Error uploading voice', e);
            Alert.alert('Error', 'No se pudo enviar la nota de voz.');
        } finally {
            setUploadingImage(false);
            setRecordingTime(0);
        }
    };

    const cancelRecording = async () => {
        if (!recordingRef.current) return;
        setIsRecording(false);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
        setRecordingTime(0);
    };

    // Toggle reaction
    const toggleReaction = async (messageId: string, emoji: string) => {
        if (!currentUser) return;
        const msg = messages.find((m: any) => m.id === messageId);
        if (!msg) return;

        const existing = msg.reactions?.find((r: any) => r.emoji === emoji && r.user_id === currentUser.id);
        if (existing) {
            setMessages(prev => prev.map((m: any) => m.id === messageId ? { ...m, reactions: m.reactions.filter((r: any) => r.id !== existing.id) } : m));
            await supabase.from('message_reactions').delete().eq('id', existing.id);
        } else {
            const tempR = { id: `temp-${Date.now()}`, message_id: messageId, user_id: currentUser.id, user_email: currentUser.email, emoji, created_at: new Date().toISOString() };
            setMessages(prev => prev.map((m: any) => m.id === messageId ? { ...m, reactions: [...(m.reactions || []), tempR] } : m));
            const { data } = await supabase.from('message_reactions').insert({ message_id: messageId, user_id: currentUser.id, user_email: currentUser.email, emoji }).select().single();
            if (data) {
                setMessages(prev => prev.map((m: any) => m.id === messageId ? { ...m, reactions: m.reactions.map((r: any) => r.id === tempR.id ? data : r) } : m));
            }
        }
    };

    // Toggle pin
    const togglePin = async (messageId: string, isPinned: boolean) => {
        setMessages(prev => prev.map((m: any) => m.id === messageId ? { ...m, is_pinned: !isPinned } : m));
        setSelectedMsg(null);
        await supabase.from('messages').update({ is_pinned: !isPinned }).eq('id', messageId);
    };

    // Search
    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) { setSearchResults([]); return; }
        setIsSearching(true);
        const { data } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).is('deleted_at', null).ilike('content', `%${query}%`).order('created_at', { ascending: false }).limit(20);
        setSearchResults(data || []);
        setIsSearching(false);
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

    // Audio playback
    const playAudio = async (url: string) => {
        try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
            const { sound } = await Audio.Sound.createAsync({ uri: url });
            await sound.playAsync();
        } catch (e) {
            console.error('Error playing audio', e);
        }
    };

    const bgColors = isDark ? ['#09090b', '#000000'] as const : ['#fafafa', '#f4f4f5'] as const;

    const renderMessage = ({ item }: { item: any }) => {
        const isMe = item.user_id === currentUser?.id;
        const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isDeleted = !!item.deleted_at;
        const textStyle = isMe ? { textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 } : {};

        // Build content
        let contentElement;
        if (isDeleted) {
            contentElement = <Text className={`italic ${isMe ? 'text-white/60' : (isDark ? 'text-zinc-500' : 'text-zinc-400')}`}>🚫 Este mensaje fue eliminado</Text>;
        } else {
            contentElement = (
                <View>
                    {/* Pin badge */}
                    {item.is_pinned && (
                        <View className="flex-row items-center gap-1 mb-1">
                            <Pin size={10} color={isMe ? '#fcd34d' : '#f59e0b'} />
                            <Text className={`text-[9px] font-bold ${isMe ? 'text-amber-300' : 'text-amber-500'}`}>Fijado</Text>
                        </View>
                    )}

                    {/* Reply quote */}
                    {item.reply_to && (
                        <View className={`border-l-[3px] pl-3 mb-2 ${isMe ? 'border-white/60 bg-black/15' : 'border-rose-500 bg-rose-500/10'} rounded-lg py-2 pr-3`}>
                            <Text className={`text-[11px] font-black tracking-tight mb-0.5 ${isMe ? 'text-white' : 'text-rose-600'}`}>
                                {item.reply_to.user_email?.split('@')[0] || 'Staff'}
                            </Text>
                            <Text className={`text-[12px] leading-4 ${isMe ? 'text-white/75' : (isDark ? 'text-zinc-400' : 'text-zinc-600')}`} numberOfLines={2}>
                                {item.reply_to.message_type === 'image' ? '📷 Imagen' : item.reply_to.message_type === 'audio' ? '🎤 Audio' : item.reply_to.content}
                            </Text>
                        </View>
                    )}
                    {/* Legacy text-based quote fallback */}
                    {!item.reply_to && item.content?.startsWith('> Citando a') && (() => {
                        const parts = item.content.split('\n\n');
                        const quoteLines = parts[0].split('\n');
                        const author = quoteLines[0]?.replace('> Citando a ', '').replace(':', '').trim() || 'Usuario';
                        const quoted = quoteLines.slice(1).join('\n').replace(/^>\s?"?/, '').replace(/"?$/, '').trim();
                        const reply = parts.slice(1).join('\n\n');
                        return (
                            <View>
                                <View className={`border-l-[3px] pl-3 mb-2 ${isMe ? 'border-white/60 bg-black/15' : 'border-rose-500 bg-rose-500/10'} rounded-lg py-2 pr-3`}>
                                    <Text className={`text-[11px] font-black tracking-tight mb-0.5 ${isMe ? 'text-white' : 'text-rose-600'}`}>{author}</Text>
                                    <Text className={`text-[12px] leading-4 ${isMe ? 'text-white/75' : (isDark ? 'text-zinc-400' : 'text-zinc-600')}`} numberOfLines={2}>{quoted}</Text>
                                </View>
                                <Text className={`text-[15px] leading-5 font-medium ${isMe ? 'text-white' : (isDark ? 'text-zinc-100' : 'text-zinc-800')}`} style={textStyle}>{reply}</Text>
                            </View>
                        );
                    })()}

                    {/* Image */}
                    {item.message_type === 'image' && item.media_url && (
                        <TouchableOpacity onPress={() => Linking.openURL(item.media_url)} className="mb-1">
                            <Image source={{ uri: item.media_url }} className="w-[220px] h-[220px] rounded-[18px]" resizeMode="cover" />
                        </TouchableOpacity>
                    )}

                    {/* Audio */}
                    {item.message_type === 'audio' && item.media_url && (
                        <TouchableOpacity onPress={() => playAudio(item.media_url)} className="flex-row items-center gap-2.5 py-1">
                            <View className={`w-9 h-9 rounded-full items-center justify-center ${isMe ? 'bg-white/20' : 'bg-rose-500/15'}`}>
                                <Headphones size={16} color={isMe ? '#fff' : '#e11d48'} />
                            </View>
                            <View className="flex-1">
                                <Text className={`text-[13px] font-bold ${isMe ? 'text-white' : (isDark ? 'text-zinc-200' : 'text-zinc-800')}`}>Nota de voz</Text>
                                <Text className={`text-[10px] ${isMe ? 'text-white/60' : (isDark ? 'text-zinc-500' : 'text-zinc-400')}`}>Toca para reproducir</Text>
                            </View>
                        </TouchableOpacity>
                    )}

                    {/* File */}
                    {item.message_type === 'file' && item.media_url && (
                        <TouchableOpacity onPress={() => Linking.openURL(item.media_url)} className={`flex-row items-center gap-2.5 px-3 py-2 rounded-xl ${isMe ? 'bg-white/10' : (isDark ? 'bg-zinc-700/50' : 'bg-zinc-100')}`}>
                            <View className={`w-8 h-8 rounded-lg items-center justify-center ${isMe ? 'bg-white/15' : 'bg-rose-500/10'}`}>
                                <FileText size={16} color={isMe ? '#e4e4e7' : '#e11d48'} />
                            </View>
                            <View className="flex-1">
                                <Text className={`text-[12px] font-bold ${isMe ? 'text-white' : (isDark ? 'text-zinc-200' : 'text-zinc-800')}`} numberOfLines={1}>
                                    {item.media_url.split('/').pop()?.split('-').slice(1).join('-') || 'Documento'}
                                </Text>
                                <Text className={`text-[9px] ${isMe ? 'text-white/50' : (isDark ? 'text-zinc-500' : 'text-zinc-400')}`}>Toca para abrir</Text>
                            </View>
                        </TouchableOpacity>
                    )}

                    {/* Text (only for text messages not handled by legacy quote) */}
                    {item.message_type === 'text' && !item.content?.startsWith('> Citando a') && (
                        <Text className={`text-[15px] leading-5 font-medium ${isMe ? 'text-white' : (isDark ? 'text-zinc-100' : 'text-zinc-800')}`} style={textStyle}>{item.content}</Text>
                    )}
                </View>
            );
        }

        // Reactions grouped
        const reactionsEl = item.reactions && item.reactions.length > 0 ? (
            <View className="flex-row flex-wrap gap-1 mt-1.5 px-1">
                {Object.entries(
                    item.reactions.reduce((acc: Record<string, { count: number; hasMe: boolean }>, r: any) => {
                        if (!acc[r.emoji]) acc[r.emoji] = { count: 0, hasMe: false };
                        acc[r.emoji].count++;
                        if (r.user_id === currentUser?.id) acc[r.emoji].hasMe = true;
                        return acc;
                    }, {})
                ).map(([emoji, data]: any) => (
                    <TouchableOpacity key={emoji} onPress={() => toggleReaction(item.id, emoji)}
                        className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full border ${data.hasMe ? 'bg-rose-500/15 border-rose-500/30' : (isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-zinc-200')}`}>
                        <Text className="text-[12px]">{emoji}</Text>
                        <Text className={`text-[10px] font-bold ${data.hasMe ? 'text-rose-500' : (isDark ? 'text-zinc-400' : 'text-zinc-500')}`}>{data.count}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        ) : null;

        if (isMe) {
            return (
                <Animated.View layout={Layout.springify()} entering={FadeInDown.springify()} className="self-end max-w-[80%] my-1 mx-3">
                    <TouchableOpacity activeOpacity={0.7} onLongPress={() => !isDeleted && setSelectedMsg(item)}
                        style={{ shadowColor: '#e11d48', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 5 }}>
                        <View style={{ borderRadius: 24, overflow: 'hidden' }}>
                            <LinearGradient colors={isDeleted ? ['#3f3f46', '#27272a'] : ['#f43f5e', '#be123c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="p-3 px-5">
                                {contentElement}
                                <View className="flex-row items-center justify-end mt-1 gap-1 opacity-90">
                                    {item.is_edited && !isDeleted && <Text className="text-[10px] text-white/70 italic mr-1">(editado)</Text>}
                                    <Text className="text-[10px] text-white/90 font-bold tracking-wider">{timeStr}</Text>
                                    {!isDeleted && <CheckCheck size={14} color={item.is_read ? "#38bdf8" : "#fecdd3"} strokeWidth={2.5} />}
                                </View>
                            </LinearGradient>
                            {!isDeleted && <View className="absolute inset-0 rounded-[24px] border-t border-white/30 border-l border-white/10" pointerEvents="none" />}
                        </View>
                    </TouchableOpacity>
                    {reactionsEl}
                </Animated.View>
            );
        }

        return (
            <Animated.View layout={Layout.springify()} entering={FadeInDown.springify()} className="self-start max-w-[80%] my-1 mx-3">
                <TouchableOpacity activeOpacity={0.7} onLongPress={() => !isDeleted && setSelectedMsg(item)}>
                    <View className="flex-row items-end">
                        <View style={{ borderRadius: 24, shadowColor: isDark ? '#000' : '#e11d48', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.05, shadowRadius: 8, elevation: 3 }}
                            className={`p-3.5 px-5 border ${isDark ? 'bg-zinc-800/90 border-zinc-700/50' : 'bg-white border-rose-500/10'}`}>
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
                {reactionsEl}
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

                    <View className="flex-row items-end p-3 pt-2 pb-6 gap-2">
                        {isRecording ? (
                            <>
                                <View className={`flex-1 h-12 rounded-[24px] flex-row items-center px-4 gap-2 ${isDark ? 'bg-red-900/30 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                                    <View className="w-2.5 h-2.5 rounded-full bg-red-500" style={{ opacity: recordingTime % 2 === 0 ? 1 : 0.3 }} />
                                    <Text className="text-sm font-bold text-red-500">
                                        {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
                                    </Text>
                                    <Text className={`text-xs flex-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Grabando...</Text>
                                </View>
                                <TouchableOpacity onPress={cancelRecording} className={`w-11 h-11 rounded-full items-center justify-center ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                                    <X size={18} color={isDark ? '#a1a1aa' : '#71717a'} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={stopRecording} className="w-12 h-12 rounded-full items-center justify-center bg-red-500 shadow-sm">
                                    <Square size={16} color="#fff" fill="#fff" />
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity onPress={handleImagePick} disabled={uploadingImage}
                                    className={`w-11 h-11 rounded-full items-center justify-center border ${isDark ? 'bg-zinc-800 border-zinc-700/50' : 'bg-white border-zinc-200/50'} shadow-sm`}>
                                    {uploadingImage ? <ActivityIndicator size="small" color="#e11d48" /> : <ImageIcon color={isDark ? '#a1a1aa' : '#71717a'} size={18} />}
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleDocumentPick} disabled={uploadingImage}
                                    className={`w-11 h-11 rounded-full items-center justify-center border ${isDark ? 'bg-zinc-800 border-zinc-700/50' : 'bg-white border-zinc-200/50'} shadow-sm`}>
                                    <Paperclip color={isDark ? '#a1a1aa' : '#71717a'} size={18} />
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

                                {newMessage.trim() || editingMsg ? (
                                    <TouchableOpacity onPress={handleSend} className="w-12 h-12 rounded-full overflow-hidden shadow-sm">
                                        <LinearGradient colors={['#e11d48', '#be123c']} className="flex-1 items-center justify-center">
                                            {editingMsg ? <Check color="#fff" size={20} /> : <Send color="#fff" size={18} />}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity onPress={startRecording} className="w-12 h-12 rounded-full overflow-hidden shadow-sm">
                                        <LinearGradient colors={isDark ? ['#27272a', '#18181b'] : ['#e4e4e7', '#d4d4d8']} className="flex-1 items-center justify-center">
                                            <Mic color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
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
                            {/* Quick Reactions */}
                            <View className="flex-row justify-center gap-2 mb-2">
                                {QUICK_REACTIONS.map(emoji => (
                                    <TouchableOpacity key={emoji} onPress={() => { toggleReaction(selectedMsg.id, emoji); setSelectedMsg(null); }}
                                        className={`w-12 h-12 rounded-full items-center justify-center ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                                        <Text className="text-[22px]">{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

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

                            {/* Pin toggle - available for all */}
                            <TouchableOpacity 
                                className={`flex-row items-center p-4 rounded-2xl ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}
                                onPress={() => togglePin(selectedMsg.id, !!selectedMsg.is_pinned)}
                            >
                                {selectedMsg?.is_pinned ? <PinOff size={22} color="#f59e0b" /> : <Pin size={22} color="#f59e0b" />}
                                <Text className={`text-lg font-semibold ml-4 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{selectedMsg?.is_pinned ? 'Desfijar' : 'Fijar mensaje'}</Text>
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
