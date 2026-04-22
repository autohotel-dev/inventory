import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, RefreshControl, TouchableOpacity, Alert, ScrollView, Dimensions, Modal, Pressable } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/theme-context';
import * as Haptics from 'expo-haptics';
import { Skeleton } from '../../components/Skeleton';
import { Ban, Droplets, Wind, BedDouble, X, CheckCircle, AlertTriangle, Wrench } from 'lucide-react-native';
import { Room } from '../../lib/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 10;
const PADDING = 16;
const NUM_COLUMNS = 3;
const CARD_SIZE = (SCREEN_WIDTH - (PADDING * 2) - (CARD_GAP * (NUM_COLUMNS - 1))) / NUM_COLUMNS;

type CamaristaRoomStatus = 'LIBRE' | 'SUCIA' | 'BLOQUEADA' | 'OCUPADA' | string;

// ==========================================
// Componente: Resumen de estados
// ==========================================
function StatusSummary({ rooms, isDark }: { rooms: Room[]; isDark: boolean }) {
    const counts = {
        LIBRE: rooms.filter(r => r.status === 'LIBRE').length,
        SUCIA: rooms.filter(r => r.status === 'SUCIA').length,
        OCUPADA: rooms.filter(r => r.status === 'OCUPADA').length,
        BLOQUEADA: rooms.filter(r => r.status === 'BLOQUEADA').length,
    };

    const items = [
        { label: 'Limpias', count: counts.LIBRE, color: '#10b981', bg: isDark ? 'bg-emerald-950/50' : 'bg-emerald-50' },
        { label: 'Sucias', count: counts.SUCIA, color: '#f97316', bg: isDark ? 'bg-orange-950/50' : 'bg-orange-50' },
        { label: 'Ocupadas', count: counts.OCUPADA, color: '#3b82f6', bg: isDark ? 'bg-blue-950/50' : 'bg-blue-50' },
        { label: 'Bloqueadas', count: counts.BLOQUEADA, color: '#71717a', bg: isDark ? 'bg-zinc-900' : 'bg-zinc-100' },
    ];

    return (
        <View className="flex-row gap-2 mb-4">
            {items.map(item => (
                <View key={item.label} className={`flex-1 items-center py-2.5 rounded-2xl ${item.bg}`}>
                    <Text style={{ color: item.color, fontSize: 20, fontWeight: '900' }}>{item.count}</Text>
                    <Text style={{ color: item.color, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{item.label}</Text>
                </View>
            ))}
        </View>
    );
}

// ==========================================
// Componente: Modal de acciones de habitación
// ==========================================
function RoomActionModal({ 
    room, 
    visible, 
    onClose, 
    onUpdateStatus, 
    isDark 
}: { 
    room: Room | null; 
    visible: boolean; 
    onClose: () => void; 
    onUpdateStatus: (roomId: string, status: string) => void;
    isDark: boolean;
}) {
    if (!room) return null;

    const isOccupied = room.status === 'OCUPADA';
    const currentStyle = getStatusStyle(room.status, isDark);

    const actions = [
        {
            label: 'Marcar como Limpia',
            status: 'LIBRE',
            icon: <CheckCircle size={28} color="#ffffff" />,
            bg: '#10b981',
            activeBg: '#059669',
            description: 'La habitación está lista para recibir huéspedes',
        },
        {
            label: 'Marcar como Sucia',
            status: 'SUCIA',
            icon: <Droplets size={28} color="#ffffff" />,
            bg: '#f97316',
            activeBg: '#ea580c',
            description: 'La habitación necesita limpieza',
        },
        {
            label: 'Reportar Mantenimiento',
            status: 'BLOQUEADA',
            icon: <Wrench size={28} color="#ffffff" />,
            bg: '#71717a',
            activeBg: '#52525b',
            description: 'La habitación tiene un problema y no se puede usar',
        },
    ];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable 
                onPress={onClose}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
            >
                <Pressable 
                    onPress={() => {}} // Prevenir que el toque cierre el modal
                    style={{
                        backgroundColor: isDark ? '#18181b' : '#ffffff',
                        borderTopLeftRadius: 28,
                        borderTopRightRadius: 28,
                        paddingBottom: 40,
                    }}
                >
                    {/* Handle bar */}
                    <View className="items-center pt-3 pb-2">
                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? '#3f3f46' : '#d4d4d8' }} />
                    </View>

                    {/* Header con número de habitación */}
                    <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                                {/* Badge grande con número */}
                                <View style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 20,
                                    backgroundColor: currentStyle.bg,
                                    borderWidth: 2,
                                    borderColor: currentStyle.border,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}>
                                    <Text style={{ fontSize: 26, fontWeight: '900', color: currentStyle.numberColor }}>
                                        {room.number}
                                    </Text>
                                </View>
                                <View>
                                    <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? '#ffffff' : '#09090b' }}>
                                        Habitación {room.number}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                        {currentStyle.icon}
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: currentStyle.textColor }}>
                                            {currentStyle.label}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Botón cerrar */}
                            <TouchableOpacity
                                onPress={onClose}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 12,
                                    backgroundColor: isDark ? '#27272a' : '#f4f4f5',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <X size={18} color={isDark ? '#71717a' : '#a1a1aa'} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Aviso de ocupada */}
                    {isOccupied && (
                        <View style={{
                            marginHorizontal: 24,
                            marginBottom: 16,
                            backgroundColor: isDark ? '#1e1b4b' : '#eef2ff',
                            borderRadius: 16,
                            padding: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            borderWidth: 1,
                            borderColor: isDark ? '#312e81' : '#c7d2fe',
                        }}>
                            <AlertTriangle size={22} color="#6366f1" />
                            <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: isDark ? '#a5b4fc' : '#4338ca', lineHeight: 18 }}>
                                Esta habitación está ocupada. No se puede cambiar su estado hasta que el huésped salga.
                            </Text>
                        </View>
                    )}

                    {/* Botones de acción */}
                    {!isOccupied && (
                        <View style={{ paddingHorizontal: 24, gap: 10 }}>
                            {actions.map(action => {
                                const isCurrentStatus = room.status === action.status;

                                return (
                                    <TouchableOpacity
                                        key={action.status}
                                        activeOpacity={0.8}
                                        disabled={isCurrentStatus}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                            onUpdateStatus(room.id, action.status);
                                            onClose();
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: isCurrentStatus 
                                                ? (isDark ? '#27272a' : '#f4f4f5') 
                                                : action.bg,
                                            borderRadius: 20,
                                            padding: 18,
                                            gap: 14,
                                            opacity: isCurrentStatus ? 0.5 : 1,
                                        }}
                                    >
                                        <View style={{
                                            width: 52,
                                            height: 52,
                                            borderRadius: 16,
                                            backgroundColor: isCurrentStatus 
                                                ? (isDark ? '#3f3f46' : '#e4e4e7')
                                                : 'rgba(255,255,255,0.2)',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                        }}>
                                            {action.icon}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{
                                                fontSize: 16,
                                                fontWeight: '800',
                                                color: isCurrentStatus 
                                                    ? (isDark ? '#71717a' : '#a1a1aa')
                                                    : '#ffffff',
                                            }}>
                                                {isCurrentStatus ? `✓ ${action.label}` : action.label}
                                            </Text>
                                            <Text style={{
                                                fontSize: 12,
                                                fontWeight: '500',
                                                color: isCurrentStatus 
                                                    ? (isDark ? '#52525b' : '#d4d4d8')
                                                    : 'rgba(255,255,255,0.75)',
                                                marginTop: 2,
                                            }}>
                                                {isCurrentStatus ? 'Estado actual' : action.description}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ==========================================
// Helper: Estilos por estado
// ==========================================
function getStatusStyle(status: CamaristaRoomStatus, isDark: boolean) {
    switch (status) {
        case 'LIBRE':
            return {
                bg: isDark ? '#064e3b' : '#d1fae5',
                border: isDark ? '#047857' : '#6ee7b7',
                textColor: isDark ? '#34d399' : '#047857',
                numberColor: isDark ? '#ecfdf5' : '#064e3b',
                icon: <Wind size={16} color={isDark ? '#34d399' : '#047857'} />,
                label: 'LIMPIA',
            };
        case 'SUCIA':
            return {
                bg: isDark ? '#431407' : '#fff7ed',
                border: isDark ? '#c2410c' : '#fdba74',
                textColor: isDark ? '#fb923c' : '#c2410c',
                numberColor: isDark ? '#fff7ed' : '#431407',
                icon: <Droplets size={16} color={isDark ? '#fb923c' : '#c2410c'} />,
                label: 'SUCIA',
            };
        case 'BLOQUEADA':
            return {
                bg: isDark ? '#18181b' : '#f4f4f5',
                border: isDark ? '#3f3f46' : '#d4d4d8',
                textColor: isDark ? '#71717a' : '#52525b',
                numberColor: isDark ? '#a1a1aa' : '#3f3f46',
                icon: <Ban size={16} color={isDark ? '#71717a' : '#52525b'} />,
                label: 'MANT.',
            };
        case 'OCUPADA':
            return {
                bg: isDark ? '#172554' : '#eff6ff',
                border: isDark ? '#1d4ed8' : '#93c5fd',
                textColor: isDark ? '#60a5fa' : '#1d4ed8',
                numberColor: isDark ? '#eff6ff' : '#172554',
                icon: <BedDouble size={16} color={isDark ? '#60a5fa' : '#1d4ed8'} />,
                label: 'OCUPADA',
            };
        default:
            return {
                bg: isDark ? '#18181b' : '#f4f4f5',
                border: isDark ? '#3f3f46' : '#d4d4d8',
                textColor: isDark ? '#71717a' : '#52525b',
                numberColor: isDark ? '#a1a1aa' : '#3f3f46',
                icon: null,
                label: status,
            };
    }
}

// ==========================================
// Pantalla principal
// ==========================================
export default function CamaristaPanel() {
    const { isDark } = useTheme();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const fetchRooms = useCallback(async (quiet = false) => {
        if (!quiet && rooms.length === 0) setLoading(true);
        try {
            const { data, error } = await supabase
                .from("rooms")
                .select(`
                    id,
                    number,
                    status,
                    room_type_id,
                    room_types(*)
                `)
                .order("number");

            if (error) throw error;
            setRooms((data as any) || []);
        } catch (error) {
            console.error("Error fetching rooms for camarista:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [rooms.length]);

    const fetchRoomsRef = useRef(fetchRooms);
    useEffect(() => { fetchRoomsRef.current = fetchRooms; }, [fetchRooms]);

    useEffect(() => {
        fetchRoomsRef.current();

        const channel = supabase.channel('camarista-rooms')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
                fetchRoomsRef.current(true);
            })
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

    const updateRoomStatus = async (roomId: string, newStatus: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // Optimistic update
        setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: newStatus } : r));

        try {
            const { error } = await supabase
                .from('rooms')
                .update({ status: newStatus })
                .eq('id', roomId);
            
            if (error) throw error;
        } catch (error) {
            console.error("Error updating room status:", error);
            Alert.alert("Error", "No se pudo actualizar el estado de la habitación.");
            fetchRooms(true); 
        }
    };

    const handleRoomPress = (room: Room) => {
        Haptics.selectionAsync();
        setSelectedRoom(room);
        setModalVisible(true);
    };

    if (loading) {
        return (
            <View className={`flex-1 p-4 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
                <View className="flex-row gap-2 mb-4">
                    {[1, 2, 3, 4].map(i => (
                        <View key={i} className="flex-1">
                            <Skeleton height={52} borderRadius={16} />
                        </View>
                    ))}
                </View>
                <View className="flex-row flex-wrap" style={{ gap: CARD_GAP }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                        <View key={i}>
                            <Skeleton height={CARD_SIZE} width={CARD_SIZE} borderRadius={16} />
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    return (
        <View className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
            <ScrollView
                contentContainerStyle={{ padding: PADDING, paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={isDark ? '#94a3b8' : '#64748b'}
                    />
                }
            >
                {/* Resumen de estados */}
                <StatusSummary rooms={rooms} isDark={isDark} />

                {/* Grid de habitaciones */}
                <View className="flex-row flex-wrap" style={{ gap: CARD_GAP }}>
                    {rooms.map(room => {
                        const style = getStatusStyle(room.status, isDark);
                        const isOccupied = room.status === 'OCUPADA';

                        return (
                            <TouchableOpacity
                                key={room.id}
                                activeOpacity={0.6}
                                onPress={() => handleRoomPress(room)}
                                style={{
                                    width: CARD_SIZE,
                                    height: CARD_SIZE,
                                    backgroundColor: style.bg,
                                    borderColor: style.border,
                                    borderWidth: 2,
                                    borderRadius: 16,
                                    padding: 10,
                                    justifyContent: 'space-between',
                                    opacity: isOccupied ? 0.6 : 1,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 28,
                                        fontWeight: '900',
                                        color: style.numberColor,
                                        letterSpacing: -1,
                                    }}
                                >
                                    {room.number}
                                </Text>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    {style.icon}
                                    <Text
                                        style={{
                                            fontSize: 8,
                                            fontWeight: '800',
                                            color: style.textColor,
                                            textTransform: 'uppercase',
                                            letterSpacing: 1,
                                        }}
                                    >
                                        {style.label}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {rooms.length === 0 && (
                    <View className="items-center justify-center py-20">
                        <Text className={`font-bold ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                            No hay habitaciones dadas de alta.
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Modal de acciones */}
            <RoomActionModal
                room={selectedRoom}
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onUpdateStatus={updateRoomStatus}
                isDark={isDark}
            />
        </View>
    );
}
