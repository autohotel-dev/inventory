import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, RefreshControl, ScrollView, Dimensions, Alert, TextInput } from 'react-native';
import { apiClient } from '../../lib/api/client';
import { useRealtimeSubscription } from '../../lib/api/websocket';
import { useUserRole } from '../../hooks/use-user-role';
import { useTheme } from '../../contexts/theme-context';
import { Tv, Search, CheckCircle2, AlertTriangle, ArrowRight, Clock, Zap, ChevronRight, User } from 'lucide-react-native';
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

interface AuditLogEntry {
    log_id: string;
    created_at: string;
    room_number: string;
    action_type: string;
    previous_status: string | null;
    new_status: string;
    action_by_name: string;
    assigned_to_name: string;
}

export default function AssetsScreen() {
    const { employeeId, hasActiveShift, isLoading: roleLoading } = useUserRole();
    const { isDark } = useTheme();
    const [rooms, setRooms] = useState<RoomAssetData[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterState, setFilterState] = useState<'TODOS' | 'MIS_ASIGNACIONES' | 'PENDIENTES' | 'TV_ENCENDIDA' | 'EXTRAVIADOS' | 'MI_HISTORIAL'>('TODOS');
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    
    // Modal states
    const [feedback, setFeedback] = useState<{ visible: boolean; title: string; message: string; type: FeedbackType }>({
        visible: false, title: '', message: '', type: 'info'
    });
    const [confirm, setConfirm] = useState<{ visible: boolean; roomId: string; roomNumber: string }>({
        visible: false, roomId: '', roomNumber: ''
    });
    
    // We only need the generic fetchRooms to re-fetch after action, but we will write our own optimized fetch
    const { handleConfirmTvOn } = useValetActions(() => fetchRooms(true));

    const fetchAuditHistory = useCallback(async () => {
        if (!employeeId) return;
        setAuditLoading(true);
        try {
            const { data } = await apiClient.post('/system/rpc/get_tv_audit_trail', {
                p_employee_id: employeeId,
                p_limit: 50,
                p_offset: 0,
            });
            setAuditLogs(data || []);
        } catch (err) {
            console.error('Error fetching audit history:', err);
        } finally {
            setAuditLoading(false);
        }
    }, [employeeId]);

    const fetchRooms = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const { data } = await apiClient.get('/system/crud/rooms', {
                params: {
                    select: 'id,number,status,room_assets(id,asset_type,status,assigned_employee_id)',
                    order: 'number'
                }
            });
            
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
            formattedData.sort((a: any, b: any) => parseInt(a.number) - parseInt(b.number));
            
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

    const debouncedFetch = useCallback(() => {
        let timeout: NodeJS.Timeout;
        return () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fetchRoomsRef.current(true), 800);
        };
    }, []);

    const fetchRoomsThrottled = useMemo(() => debouncedFetch(), [debouncedFetch]);

    // Use Realtime Subscription instead of direct supabase channel
    const unsubscribeAssets = useRealtimeSubscription('assets-realtime', fetchRoomsThrottled);

    useEffect(() => {
        fetchRoomsRef.current();

        // Polling de respaldo cada 10s
        const pollInterval = setInterval(() => {
            fetchRoomsRef.current(true);
        }, 10000);

        return () => {
            unsubscribeAssets();
            clearInterval(pollInterval);
        };
    }, [unsubscribeAssets]);

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
        setRooms(prev => prev.map(r => r.id === roomId ? { ...r, tvRemoteStatus: 'TV_ENCENDIDA' } : r));
        
        const success = await handleConfirmTvOn(roomId, employeeId);
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
            case 'MIS_ASIGNACIONES':
                result = result.filter(r => r.tvRemoteStatus === 'PENDIENTE_ENCENDIDO' && r.assignedEmployeeId === employeeId);
                break;
            case 'PENDIENTES':
                result = result.filter(r => r.tvRemoteStatus === 'PENDIENTE_ENCENDIDO');
                break;
            case 'TV_ENCENDIDA':
                result = result.filter(r => r.tvRemoteStatus === 'TV_ENCENDIDA');
                break;
            case 'EXTRAVIADOS':
                result = result.filter(r => r.tvRemoteStatus === 'EXTRAVIADO');
                break;
        }

        return result;
    }, [rooms, filterState, searchQuery, employeeId]);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'TV_ENCENDIDA': return { bg: isDark ? '#064e3b' : '#d1fae5', border: isDark ? '#047857' : '#10b981', text: isDark ? '#34d399' : '#047857', iconColor: isDark ? '#34d399' : '#059669', label: 'TV Encend.' };
            case 'PENDIENTE_ENCENDIDO': return { bg: isDark ? '#451a03' : '#fef3c7', border: isDark ? '#b45309' : '#f59e0b', text: isDark ? '#fbbf24' : '#b45309', iconColor: isDark ? '#fbbf24' : '#d97706', label: 'Pendiente' };
            case 'EN_HABITACION': return { bg: isDark ? '#27272a' : '#f4f4f5', border: isDark ? '#3f3f46' : '#d4d4d8', text: isDark ? '#a1a1aa' : '#71717a', iconColor: isDark ? '#a1a1aa' : '#71717a', label: 'Sin Tarea' };
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
                        { id: 'MIS_ASIGNACIONES', label: 'Mis Asignaciones' },
                        { id: 'PENDIENTES', label: 'Pendientes' },
                        { id: 'TV_ENCENDIDA', label: 'TV Encendida' },
                        { id: 'EXTRAVIADOS', label: 'Extraviados' },
                        { id: 'MI_HISTORIAL', label: '📋 Mi Historial' }
                    ].map(f => (
                        <TouchableOpacity
                            key={f.id}
                            onPress={() => {
                                setFilterState(f.id as any);
                                if (f.id === 'MI_HISTORIAL') fetchAuditHistory();
                            }}
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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { onRefresh(); if (filterState === 'MI_HISTORIAL') fetchAuditHistory(); }} tintColor={isDark ? '#94a3b8' : '#64748b'} />}
            >
                {filterState === 'MI_HISTORIAL' ? (
                    /* ─── AUDIT HISTORY TIMELINE ─── */
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <Clock size={16} color={isDark ? '#a78bfa' : '#7c3aed'} />
                            <Text style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#ffffff' : '#000000', textTransform: 'uppercase', letterSpacing: 1 }}>
                                Mi Historial de Controles
                            </Text>
                        </View>
                        {auditLoading ? (
                            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                <Text style={{ color: isDark ? '#71717a' : '#a1a1aa', fontSize: 12 }}>Cargando historial...</Text>
                            </View>
                        ) : auditLogs.length === 0 ? (
                            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                <Clock size={40} color={isDark ? '#3f3f46' : '#d4d4d8'} />
                                <Text style={{ color: isDark ? '#52525b' : '#a1a1aa', fontSize: 13, fontWeight: '700', marginTop: 12 }}>Sin registros aún</Text>
                            </View>
                        ) : (
                            auditLogs.map((log, idx) => {
                                const ACTION_LABELS: Record<string, { label: string; color: string; bg: string; bgDark: string }> = {
                                    'ASSIGNED_TO_COCHERO_FOR_TV': { label: 'Asignación', color: '#f59e0b', bg: '#fef3c7', bgDark: '#451a03' },
                                    'ASSIGNED_TO_COCHERO': { label: 'Asignación', color: '#f59e0b', bg: '#fef3c7', bgDark: '#451a03' },
                                    'CONFIRMED_TV_ON': { label: 'TV Confirmada', color: '#10b981', bg: '#ecfdf5', bgDark: '#052e16' },
                                    'DROPPED_IN_ROOM': { label: 'Dejado en Habitación', color: '#3b82f6', bg: '#dbeafe', bgDark: '#172554' },
                                    'VERIFIED_IN_ROOM': { label: 'Verificado en Habitación', color: '#10b981', bg: '#ecfdf5', bgDark: '#052e16' },
                                    'MARKED_MISSING': { label: 'Extraviado', color: '#ef4444', bg: '#fee2e2', bgDark: '#450a0a' },
                                };
                                const actionInfo = ACTION_LABELS[log.action_type] || { label: log.action_type.replace(/_/g, ' '), color: '#71717a', bg: '#f4f4f5', bgDark: '#27272a' };
                                const isAssign = log.action_type.startsWith('ASSIGNED');
                                const isConfirm = log.action_type === 'CONFIRMED_TV_ON' || log.action_type === 'VERIFIED_IN_ROOM';
                                const isMissing = log.action_type === 'MARKED_MISSING';
                                const dotColor = actionInfo.color;
                                const bgColor = isDark ? actionInfo.bgDark : actionInfo.bg;
                                const ts = new Date(log.created_at);
                                const timeStr = ts.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

                                return (
                                    <View key={log.log_id} style={{ flexDirection: 'row', marginBottom: 2 }}>
                                        {/* Timeline line + dot */}
                                        <View style={{ width: 24, alignItems: 'center' }}>
                                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor, marginTop: 6, borderWidth: 2, borderColor: isDark ? '#18181b' : '#ffffff' }} />
                                            {idx < auditLogs.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: isDark ? '#27272a' : '#e4e4e7' }} />}
                                        </View>
                                        {/* Content card */}
                                        <View style={{ flex: 1, marginLeft: 8, marginBottom: 12, backgroundColor: bgColor, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: isDark ? '#27272a' : '#e4e4e7' }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    {isAssign && <Zap size={12} color={dotColor} />}
                                                    {isConfirm && <CheckCircle2 size={12} color={dotColor} />}
                                                    {isMissing && <AlertTriangle size={12} color={dotColor} />}
                                                    {!isAssign && !isConfirm && !isMissing && <Clock size={12} color={dotColor} />}
                                                    <Text style={{ fontSize: 11, fontWeight: '900', color: dotColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                        {actionInfo.label}
                                                    </Text>
                                                </View>
                                                <View style={{ backgroundColor: isDark ? '#18181b' : '#ffffff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                                                    <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#ffffff' : '#000000' }}>{log.room_number}</Text>
                                                </View>
                                            </View>
                                            <Text style={{ fontSize: 10, color: isDark ? '#71717a' : '#a1a1aa', fontFamily: 'monospace', marginBottom: 4 }}>{timeStr}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                                <User size={10} color={isDark ? '#a1a1aa' : '#71717a'} />
                                                <Text style={{ fontSize: 10, color: isDark ? '#a1a1aa' : '#71717a' }}>Por: </Text>
                                                <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#d4d4d8' : '#3f3f46' }}>{log.action_by_name}</Text>
                                                {isAssign && log.assigned_to_name !== '—' && (
                                                    <><ChevronRight size={10} color={isDark ? '#71717a' : '#a1a1aa'} /><Text style={{ fontSize: 10, fontWeight: '800', color: '#f59e0b' }}>{log.assigned_to_name}</Text></>
                                                )}
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                {(() => {
                                                    const STATUS_LABELS: Record<string, string> = {
                                                        'EN_HABITACION': 'En Habitación',
                                                        'PENDIENTE_ENCENDIDO': 'Pendiente Encendido',
                                                        'TV_ENCENDIDA': 'TV Encendida',
                                                        'EXTRAVIADO': 'Extraviado',
                                                        'SIN_REGISTRO': 'Sin Registro',
                                                    };
                                                    const prev = log.previous_status ? (STATUS_LABELS[log.previous_status] || log.previous_status.replace(/_/g, ' ')) : '—';
                                                    const next = STATUS_LABELS[log.new_status] || log.new_status.replace(/_/g, ' ');
                                                    return (<>
                                                        <Text style={{ fontSize: 9, color: isDark ? '#52525b' : '#a1a1aa', fontFamily: 'monospace' }}>{prev}</Text>
                                                        <ArrowRight size={8} color={isDark ? '#52525b' : '#a1a1aa'} />
                                                        <Text style={{ fontSize: 9, fontWeight: '800', color: isDark ? '#a1a1aa' : '#71717a', fontFamily: 'monospace' }}>{next}</Text>
                                                    </>);
                                                })()}
                                            </View>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                ) : (
                    /* ─── ROOM CARDS GRID ─── */
                    <View className="flex-row flex-wrap" style={{ gap: CARD_GAP }}>
                        {filteredRooms.map(room => {
                            const isMine = room.tvRemoteStatus === 'PENDIENTE_ENCENDIDO' && room.assignedEmployeeId === employeeId;
                            const canDrop = isMine && hasActiveShift;
                            const style = getStatusStyle(room.tvRemoteStatus);
                            return (
                                <View key={room.id} style={{ width: CARD_SIZE, backgroundColor: isDark ? '#18181b' : '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: isMine ? '#f59e0b' : (isDark ? '#27272a' : '#e4e4e7'), overflow: 'hidden' }}>
                                    <View style={{ padding: 12, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#ffffff' : '#000000' }}>{room.number}</Text>
                                        <View style={{ marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: style.bg, borderRadius: 8, borderWidth: 1, borderColor: style.border, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Tv size={12} color={style.iconColor} />
                                            <Text style={{ fontSize: 9, fontWeight: '800', color: style.text, textTransform: 'uppercase' }}>{style.label}</Text>
                                        </View>
                                    </View>
                                    {canDrop ? (
                                        <TouchableOpacity onPress={() => confirmDrop(room.id, room.number)} style={{ backgroundColor: '#f59e0b', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderTopWidth: 1, borderTopColor: isDark ? '#3f3f46' : '#e4e4e7' }}>
                                            <Text style={{ color: '#000000', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>Confirmar</Text>
                                            <ArrowRight size={12} color={'#000000'} style={{ marginLeft: 4 }} />
                                        </TouchableOpacity>
                                    ) : room.tvRemoteStatus === 'PENDIENTE_ENCENDIDO' ? (
                                        <View style={{ backgroundColor: isDark ? '#27272a' : '#f4f4f5', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderTopWidth: 1, borderTopColor: isDark ? '#3f3f46' : '#e4e4e7' }}>
                                            <AlertTriangle size={12} color={isDark ? '#fbbf24' : '#d97706'} />
                                            <Text style={{ color: isDark ? '#fbbf24' : '#d97706', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginLeft: 4 }}>Otro Cochero</Text>
                                        </View>
                                    ) : (
                                        <View style={{ backgroundColor: isDark ? '#052e16' : '#ecfdf5', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderTopWidth: 1, borderTopColor: isDark ? '#064e3b' : '#a7f3d0' }}>
                                            <CheckCircle2 size={12} color={isDark ? '#34d399' : '#059669'} />
                                            <Text style={{ color: isDark ? '#34d399' : '#059669', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginLeft: 4 }}>Listo</Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}
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
                title="Confirmar TV Encendida"
                message={`¿Confirmas que has encendido la Televisión en la Habitación ${confirm.roomNumber}?`}
                confirmText="Confirmar"
                cancelText="Cancelar"
                onConfirm={() => handleDropAction(confirm.roomId)}
                onCancel={() => setConfirm({ visible: false, roomId: '', roomNumber: '' })}
            />
        </View>
    );
}
