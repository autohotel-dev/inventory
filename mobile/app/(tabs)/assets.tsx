import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, RefreshControl, ScrollView, Dimensions, Alert, TextInput } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/use-user-role';
import { useTheme } from '../../contexts/theme-context';
import { Tv, Search, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react-native';
import { Skeleton } from '../../components/Skeleton';
import * as Haptics from 'expo-haptics';
import { useValetActions } from '../../hooks/use-valet-actions';
import { FeedbackModal, FeedbackType } from '../../components/FeedbackModal';
import { ConfirmModal } from '../../components/ConfirmModal';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 12;
const PADDING = 16;
const NUM_COLUMNS = 3;
const CARD_SIZE = (SCREEN_WIDTH - (PADDING * 2) - (CARD_GAP * (NUM_COLUMNS - 1))) / NUM_COLUMNS;

interface RoomAssetData {
    id: string;
    number: string;
    status: string;
    tvRemoteStatus: string;
    tvRemoteId?: string;
    assignedEmployeeId?: string;
}

export default function AssetsScreen() {
    const { employeeId, hasActiveShift, isLoading: roleLoading } = useUserRole();
    const { isDark } = useTheme();
    const [rooms, setRooms] = useState<RoomAssetData[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterState, setFilterState] = useState<'TODOS' | 'MIS_CONTROLES' | 'SIN_CONTROL' | 'EN_HABITACION' | 'EXTRAVIADOS'>('TODOS');
    
    // Modal states
    const [feedback, setFeedback] = useState<{ visible: boolean; title: string; message: string; type: FeedbackType }>({
        visible: false, title: '', message: '', type: 'info'
    });
    const [confirm, setConfirm] = useState<{ visible: boolean; roomId: string; roomNumber: string }>({
        visible: false, roomId: '', roomNumber: ''
    });
    
    // We only need the generic fetchRooms to re-fetch after action, but we will write our own optimized fetch
    const { handleDropAssetInRoom } = useValetActions(() => fetchRooms(true));

    const fetchRooms = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const { data, error } = await supabase
                .from("rooms")
                .select(`
                    id,
                    number,
                    status,
                    room_assets ( id, asset_type, status, assigned_employee_id )
                `)
                .order("number");

            if (error) throw error;
            
            const formattedData = (data || []).map((r: any) => {
                const tvRemote = r.room_assets?.find((a: any) => a.asset_type === 'TV_REMOTE');
                return {
                    id: r.id,
                    number: r.number,
                    status: r.status,
                    tvRemoteStatus: tvRemote?.status || 'SIN_REGISTRO',
                    tvRemoteId: tvRemote?.id,
                    assignedEmployeeId: tvRemote?.assigned_employee_id
                };
            });
            
            // Sort to push missing/unregistered to top if needed, or just by number
            formattedData.sort((a, b) => parseInt(a.number) - parseInt(b.number));
            
            setRooms(formattedData);
        } catch (error) {
            console.error("Error fetching room assets:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const fetchRoomsRef = useRef(fetchRooms);
    useEffect(() => { fetchRoomsRef.current = fetchRooms; }, [fetchRooms]);

    useEffect(() => {
        fetchRoomsRef.current();

        const channel = supabase.channel('assets-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'room_assets' }, () => fetchRoomsRef.current(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => fetchRoomsRef.current(true))
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const onRefresh = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshing(true);
        fetchRooms();
    };

    const handleDropAction = async (roomId: string) => {
        setConfirm({ visible: false, roomId: '', roomNumber: '' });
        
        if (!hasActiveShift) {
            setFeedback({
                visible: true,
                title: 'Turno Inactivo',
                message: 'Debes iniciar turno para registrar controles.',
                type: 'warning'
            });
            return;
        }
        if (!employeeId) return;
        
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        
        // Optimistic update
        setRooms(prev => prev.map(r => r.id === roomId ? { ...r, tvRemoteStatus: 'EN_HABITACION' } : r));
        
        const success = await handleDropAssetInRoom(roomId, employeeId, 'TV_REMOTE');
        if (!success) {
            // Revert on failure
            fetchRooms(true);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const confirmDrop = (roomId: string, roomNumber: string) => {
        setConfirm({ visible: true, roomId, roomNumber });
    };

    const filteredRooms = useMemo(() => {
        let result = rooms;

        if (searchQuery.trim() !== '') {
            result = result.filter(r => r.number.includes(searchQuery));
        }

        switch (filterState) {
            case 'MIS_CONTROLES':
                result = result.filter(r => r.tvRemoteStatus === 'CON_COCHERO' && r.assignedEmployeeId === employeeId);
                break;
            case 'SIN_CONTROL':
                result = result.filter(r => r.tvRemoteStatus === 'EN_RECEPCION' || r.tvRemoteStatus === 'SIN_REGISTRO' || (r.tvRemoteStatus === 'CON_COCHERO' && r.assignedEmployeeId !== employeeId));
                break;
            case 'EN_HABITACION':
                result = result.filter(r => r.tvRemoteStatus === 'EN_HABITACION');
                break;
            case 'EXTRAVIADOS':
                result = result.filter(r => r.tvRemoteStatus === 'EXTRAVIADO');
                break;
        }

        return result;
    }, [rooms, filterState, searchQuery, employeeId]);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'EN_HABITACION': return { bg: isDark ? '#064e3b' : '#d1fae5', border: isDark ? '#047857' : '#10b981', text: isDark ? '#34d399' : '#047857', iconColor: isDark ? '#34d399' : '#059669', label: 'En Cuarto' };
            case 'CON_COCHERO': return { bg: isDark ? '#1e3a8a' : '#dbeafe', border: isDark ? '#1d4ed8' : '#3b82f6', text: isDark ? '#60a5fa' : '#1d4ed8', iconColor: isDark ? '#60a5fa' : '#2563eb', label: 'Con Cochero' };
            case 'EN_RECEPCION': return { bg: isDark ? '#451a03' : '#fef3c7', border: isDark ? '#b45309' : '#f59e0b', text: isDark ? '#fbbf24' : '#b45309', iconColor: isDark ? '#fbbf24' : '#d97706', label: 'En Recep.' };
            case 'EXTRAVIADO': return { bg: isDark ? '#450a0a' : '#fee2e2', border: isDark ? '#b91c1c' : '#ef4444', text: isDark ? '#f87171' : '#b91c1c', iconColor: isDark ? '#f87171' : '#dc2626', label: 'Falta' };
            default: return { bg: isDark ? '#27272a' : '#f4f4f5', border: isDark ? '#3f3f46' : '#d4d4d8', text: isDark ? '#a1a1aa' : '#71717a', iconColor: isDark ? '#a1a1aa' : '#71717a', label: 'Sin Reg.' };
        }
    };

    if (loading || roleLoading) {
        return (
            <View className={`flex-1 p-4 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
                <View className="flex-row gap-2 mb-4">
                    <Skeleton height={36} borderRadius={16} />
                </View>
                <View className="flex-row flex-wrap" style={{ gap: CARD_GAP, paddingHorizontal: PADDING - 4 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                        <View key={i}><Skeleton height={CARD_SIZE * 1.2} width={CARD_SIZE} borderRadius={16} /></View>
                    ))}
                </View>
            </View>
        );
    }

    return (
        <View className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
            <View className="px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Buscar cuarto..."
                    placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                    className={`h-10 px-4 rounded-xl font-medium mb-3 ${isDark ? 'bg-zinc-900 text-white' : 'bg-zinc-200/50 text-black'}`}
                />
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                    {[
                        { id: 'TODOS', label: `Todos (${rooms.length})` },
                        { id: 'MIS_CONTROLES', label: 'Mis Controles' },
                        { id: 'SIN_CONTROL', label: 'Sin Control' },
                        { id: 'EN_HABITACION', label: 'En Cuarto' },
                        { id: 'EXTRAVIADOS', label: 'Extraviados' }
                    ].map(f => (
                        <TouchableOpacity
                            key={f.id}
                            onPress={() => setFilterState(f.id as any)}
                            className={`px-4 py-2 rounded-full border ${filterState === f.id 
                                ? (isDark ? 'bg-zinc-100 border-zinc-100' : 'bg-zinc-900 border-zinc-900')
                                : (isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200')
                            }`}
                        >
                            <Text className={`font-bold text-[11px] uppercase tracking-wider ${filterState === f.id
                                ? (isDark ? 'text-black' : 'text-white')
                                : (isDark ? 'text-zinc-400' : 'text-zinc-500')
                            }`}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView
                contentContainerStyle={{ padding: PADDING, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#94a3b8' : '#64748b'} />}
            >
                <View className="flex-row flex-wrap" style={{ gap: CARD_GAP }}>
                    {filteredRooms.map(room => {
                        const isMine = room.tvRemoteStatus === 'CON_COCHERO' && room.assignedEmployeeId === employeeId;
                        const canDrop = room.tvRemoteStatus !== 'EN_HABITACION' && hasActiveShift;
                        const style = getStatusStyle(room.tvRemoteStatus);

                        return (
                            <View
                                key={room.id}
                                style={{
                                    width: CARD_SIZE,
                                    backgroundColor: isDark ? '#18181b' : '#ffffff',
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: isMine ? '#3b82f6' : (isDark ? '#27272a' : '#e4e4e7'),
                                    overflow: 'hidden',
                                }}
                            >
                                <View style={{ padding: 12, alignItems: 'center' }}>
                                    <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#ffffff' : '#000000' }}>
                                        {room.number}
                                    </Text>
                                    
                                    <View style={{ 
                                        marginTop: 8, 
                                        paddingHorizontal: 8, 
                                        paddingVertical: 4, 
                                        backgroundColor: style.bg, 
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: style.border,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4
                                    }}>
                                        <Tv size={12} color={style.iconColor} />
                                        <Text style={{ fontSize: 9, fontWeight: '800', color: style.text, textTransform: 'uppercase' }}>
                                            {style.label}
                                        </Text>
                                    </View>
                                </View>
                                
                                {canDrop ? (
                                    <TouchableOpacity
                                        onPress={() => confirmDrop(room.id, room.number)}
                                        style={{
                                            backgroundColor: isMine ? '#3b82f6' : (isDark ? '#27272a' : '#f4f4f5'),
                                            paddingVertical: 10,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'row',
                                            borderTopWidth: 1,
                                            borderTopColor: isDark ? '#3f3f46' : '#e4e4e7',
                                        }}
                                    >
                                        <Text style={{ 
                                            color: isMine ? '#ffffff' : (isDark ? '#a1a1aa' : '#52525b'), 
                                            fontSize: 10, 
                                            fontWeight: '800', 
                                            textTransform: 'uppercase' 
                                        }}>
                                            Dejar
                                        </Text>
                                        <ArrowRight size={12} color={isMine ? '#ffffff' : (isDark ? '#a1a1aa' : '#52525b')} style={{ marginLeft: 4 }} />
                                    </TouchableOpacity>
                                ) : (
                                    <View
                                        style={{
                                            backgroundColor: isDark ? '#052e16' : '#ecfdf5',
                                            paddingVertical: 10,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'row',
                                            borderTopWidth: 1,
                                            borderTopColor: isDark ? '#064e3b' : '#a7f3d0',
                                        }}
                                    >
                                        <CheckCircle2 size={12} color={isDark ? '#34d399' : '#059669'} />
                                        <Text style={{ 
                                            color: isDark ? '#34d399' : '#059669', 
                                            fontSize: 10, 
                                            fontWeight: '800', 
                                            textTransform: 'uppercase',
                                            marginLeft: 4
                                        }}>
                                            Listo
                                        </Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            <FeedbackModal
                visible={feedback.visible}
                title={feedback.title}
                message={feedback.message}
                type={feedback.type}
                onConfirm={() => setFeedback(prev => ({ ...prev, visible: false }))}
            />

            <ConfirmModal
                visible={confirm.visible}
                title="Confirmar Entrega"
                message={`¿Confirmas que dejaste el Control de TV en la Habitación ${confirm.roomNumber}?`}
                confirmText="Dejar Control"
                cancelText="Cancelar"
                onConfirm={() => handleDropAction(confirm.roomId)}
                onCancel={() => setConfirm({ visible: false, roomId: '', roomNumber: '' })}
            />
        </View>
    );
}
