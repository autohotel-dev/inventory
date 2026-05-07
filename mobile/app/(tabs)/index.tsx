import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserRole } from '../../hooks/use-user-role';
import { useTheme } from '../../contexts/theme-context';
import { useFeedback } from '../../contexts/feedback-context';
import { useValetActions } from '../../hooks/use-valet-actions';
import { Clock, CheckCircle2, Car, LogOut, ShoppingBag, RefreshCw, ChevronRight, DollarSign, Zap, AlertTriangle, TrendingUp } from 'lucide-react-native';
import { apiClient } from '../../lib/api/client';
import { useRealtimeSubscription } from '../../lib/api/websocket';
import * as Haptics from 'expo-haptics';

export default function DashboardScreen() {
    const router = useRouter();
    const { employeeName, employeeId, hasActiveShift, role, isLoading, refresh } = useUserRole();
    const { isDark } = useTheme();
    const { showFeedback } = useFeedback();
    const [currentShift, setCurrentShift] = useState<any>(null);
    const [shiftStartTime, setShiftStartTime] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        entries: 0,
        inStay: 0,
        checkouts: 0,
        services: 0
    });

    // Personal shift stats
    const [myStats, setMyStats] = useState({
        totalCollected: 0,
        entriesHandled: 0,
        checkoutsHandled: 0,
        servicesDelivered: 0
    });

    // Urgent rooms for quick actions
    const [urgentRooms, setUrgentRooms] = useState<any[]>([]);

    // Animated pulse for urgents
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (urgentRooms.length > 0) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.03, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                ])
            ).start();
        }
    }, [urgentRooms.length]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return '¡Buenos días';
        if (hour < 19) return '¡Buenas tardes';
        return '¡Buenas noches';
    };

    const getFirstName = (name: string) => {
        return name?.split(' ')[0] || 'Cochero';
    };

    const fetchStats = useCallback(async () => {
        try {
            // Habitaciones con estancia activa
            const { data: rooms } = await apiClient.get('/rooms/active-stays');
            const activeRooms = rooms || [];

            const entries = activeRooms.filter((r: any) => {
                const stay = r.room_stays?.[0];
                return stay && !stay.vehicle_plate;
            });

            const inStay = activeRooms.filter((r: any) => {
                const stay = r.room_stays?.[0];
                return stay && stay.vehicle_plate && !stay.checkout_valet_employee_id;
            }).length;

            const urgents = activeRooms.filter((r: any) => {
                const stay = r.room_stays?.[0];
                return stay && stay.vehicle_plate && !stay.checkout_valet_employee_id &&
                    (stay.vehicle_requested_at || stay.valet_checkout_requested_at);
            });

            const { data: servicesData } = await apiClient.get('/system/crud/sales_order_items', {
                params: {
                    concept_type: 'eq.CONSUMPTION',
                    is_paid: 'eq.false',
                    delivery_status: 'not.in.(CANCELLED,COMPLETED,DELIVERED)'
                }
            });

            setStats({
                entries: entries.length,
                inStay,
                checkouts: urgents.length,
                services: servicesData?.length || 0
            });

            // Build urgent rooms list for quick actions (entries + urgent checkouts)
            const urgentList = [
                ...entries.map((r: any) => ({
                    id: r.id,
                    number: r.number,
                    stayId: r.room_stays?.[0]?.id,
                    type: 'entry' as const,
                    label: 'Entrada pendiente'
                })),
                ...urgents.map((r: any) => ({
                    id: r.id,
                    number: r.number,
                    stayId: r.room_stays?.[0]?.id,
                    type: 'checkout' as const,
                    label: r.room_stays?.[0]?.valet_checkout_requested_at ? 'Revisión de salida' : 'Vehículo solicitado'
                }))
            ];
            setUrgentRooms(urgentList.slice(0, 5)); // Max 5

            // Personal stats (collected money in this shift)
            if (employeeId && hasActiveShift) {
                // Get active shift session to know start time
                const { data: sessions } = await apiClient.get('/system/crud/shift_sessions', {
                    params: {
                        employee_id: `eq.${employeeId}`,
                        status: 'in.(active,open)',
                        clock_out_at: 'is.null',
                        order: 'clock_in_at.desc',
                        limit: 1
                    }
                });
                const session = sessions?.[0];

                if (session?.clock_in_at) {
                    setShiftStartTime(session.clock_in_at);

                    // Payments collected by this employee during this shift
                    const { data: payments } = await apiClient.get('/system/crud/payments', {
                        params: {
                            collected_by: `eq.${employeeId}`,
                            created_at: `gte.${session.clock_in_at}`,
                            status: 'eq.COMPLETADO'
                        }
                    });

                    const totalCollected = (payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

                    // Count my actions during shift
                    const { data: myEntries } = await apiClient.get('/system/crud/room_stays', {
                        params: {
                            valet_employee_id: `eq.${employeeId}`,
                            check_in_at: `gte.${session.clock_in_at}`
                        }
                    });

                    const { data: myCheckouts } = await apiClient.get('/system/crud/room_stays', {
                        params: {
                            checkout_valet_employee_id: `eq.${employeeId}`,
                            updated_at: `gte.${session.clock_in_at}`
                        }
                    });

                    const { data: myServices } = await apiClient.get('/system/crud/sales_order_items', {
                        params: {
                            delivery_accepted_by: `eq.${employeeId}`,
                            delivery_status: 'in.(DELIVERED,COMPLETED)',
                            delivery_completed_at: `gte.${session.clock_in_at}`
                        }
                    });

                    setMyStats({
                        totalCollected,
                        entriesHandled: myEntries?.length || 0,
                        checkoutsHandled: myCheckouts?.length || 0,
                        servicesDelivered: myServices?.length || 0
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }, [employeeId, hasActiveShift]);

    const fetchStatsRef = useRef(fetchStats);
    useEffect(() => { fetchStatsRef.current = fetchStats; }, [fetchStats]);

    useEffect(() => {
        fetchCurrentShift();
        fetchStatsRef.current();

        const unsubscribeWS = useRealtimeSubscription('global', () => {
            fetchStatsRef.current();
        });

        const interval = setInterval(() => fetchStatsRef.current(), 30000);

        return () => {
            unsubscribeWS();
            clearInterval(interval);
        };
    }, []);

    const fetchCurrentShift = async () => {
        const { data: shifts } = await apiClient.get("/system/crud/shift_definitions", {
            params: { is_active: 'eq.true' }
        });

        if (!shifts?.length) return;

        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 8);

        for (const shift of shifts) {
            const start = shift.start_time;
            const end = shift.end_time;

            if (shift.crosses_midnight) {
                if (currentTime >= start || currentTime < end) {
                    setCurrentShift(shift);
                    return;
                }
            } else {
                if (currentTime >= start && currentTime < end) {
                    setCurrentShift(shift);
                    return;
                }
            }
        }
    };

    const handleStartShift = async () => {
        if (!employeeId || !currentShift) return;

        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        try {
            await apiClient.post("/system/crud/shift_sessions", {
                employee_id: employeeId,
                shift_definition_id: currentShift.id,
                clock_in_at: new Date().toISOString(),
                status: "active",
            });

            await refresh();
            showFeedback('¡Bienvenido!', 'Tu turno ha iniciado correctamente');
        } catch (err: any) {
            const errorMessage = err.message || '';
            if (errorMessage.includes("ROLE_SHIFT_LIMIT_EXCEEDED")) {
                const parts = errorMessage.split("::");
                const currentRole = parts[1] || "tu rol";
                const limit = parts[2] || "?";
                showFeedback(
                    "Límite de Turnos Alcanzado",
                    `Ya hay ${limit} ${currentRole}(s) con turno activo.\n\nNo se permiten más turnos simultáneos para este rol.`,
                    'warning'
                );
            } else {
                showFeedback('Error', errorMessage || 'No se pudo iniciar el turno', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshing(true);
        await fetchStatsRef.current();
        await refresh();
        setRefreshing(false);
    };

    const getElapsedTime = () => {
        if (!shiftStartTime) return null;
        const start = new Date(shiftStartTime);
        const now = new Date();
        const diff = Math.floor((now.getTime() - start.getTime()) / 1000 / 60);
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    if (isLoading) {
        return (
            <View className={`flex-1 items-center justify-center ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
                <ActivityIndicator size="large" color="#a1a1aa" />
            </View>
        );
    }

    const totalActions = myStats.entriesHandled + myStats.checkoutsHandled + myStats.servicesDelivered;

    return (
        <ScrollView
            className={`flex-1 ${isDark ? 'bg-black' : 'bg-zinc-50'}`}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={isDark ? '#52525b' : '#a1a1aa'}
                />
            }
        >
            {/* Header Premium */}
            <View className={`px-5 pt-6 pb-6 rounded-b-[40px] mb-4 shadow-xl ${isDark ? 'bg-[#0a0a0a] border-b border-white/10' : 'bg-white shadow-sm'}`}>
                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <Text className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                            {getGreeting()},
                        </Text>
                        <Text className={`text-3xl font-black tracking-tight mb-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            {getFirstName(employeeName || '')}!
                        </Text>
                        <Text className={`text-xs uppercase tracking-widest font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={onRefresh}
                        activeOpacity={0.7}
                        className={`w-12 h-12 rounded-full items-center justify-center border shadow-sm ${isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-100 border-zinc-200'}`}
                    >
                        <RefreshCw color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
                    </TouchableOpacity>
                </View>
            </View>

            <View className="px-5 pb-8">
                {/* Tarjeta de Turno Glassmorphism */}
                {hasActiveShift ? (
                    <View className={`p-5 rounded-3xl mt-2 border border-emerald-500/30 overflow-hidden shadow-lg ${isDark ? 'bg-emerald-950/40' : 'bg-emerald-50'}`}>
                        {/* Decorative glow in dark mode */}
                        {isDark && <View className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl" />}
                        
                        <View className="flex-row items-center justify-between mb-5">
                            <View className="flex-row items-center">
                                <View className={`w-12 h-12 rounded-2xl items-center justify-center border ${isDark ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-emerald-100 border-emerald-200'}`}>
                                    <CheckCircle2 color={isDark ? '#34d399' : '#10b981'} size={24} />
                                </View>
                                <View className="ml-4">
                                    <Text className={`text-base font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-emerald-800'}`}>Turno Activo</Text>
                                    {getElapsedTime() && (
                                        <Text className={`text-xs font-medium ${isDark ? 'text-emerald-400/80' : 'text-emerald-600'}`}>
                                            Duración: {getElapsedTime()}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <View className={`px-3 py-1.5 rounded-full border ${isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-200 border-emerald-300'}`}>
                                <Text className={`text-xs font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                                    {totalActions} acciones
                                </Text>
                            </View>
                        </View>

                        {/* Money Stats - Elevated Card inside */}
                        <View className={`p-5 rounded-2xl border ${isDark ? 'bg-black/40 border-white/10' : 'bg-white shadow-sm border-emerald-100'}`}>
                            <View className="flex-row items-center mb-1">
                                <DollarSign color={isDark ? '#10b981' : '#059669'} size={18} />
                                <Text className={`text-xs font-black uppercase tracking-widest ml-1 ${isDark ? 'text-zinc-400' : 'text-emerald-700'}`}>
                                    Recaudación Total
                                </Text>
                            </View>
                            <Text className={`text-4xl font-black mb-4 tracking-tighter ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                ${myStats.totalCollected.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </Text>
                            
                            <View className={`flex-row gap-3 pt-4 border-t ${isDark ? 'border-white/10' : 'border-emerald-100'}`}>
                                <View className="flex-1 items-center justify-center">
                                    <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-800'}`}>{myStats.entriesHandled}</Text>
                                    <Text className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Entradas</Text>
                                </View>
                                <View className={`w-px h-full ${isDark ? 'bg-white/10' : 'bg-emerald-100'}`} />
                                <View className="flex-1 items-center justify-center">
                                    <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-800'}`}>{myStats.checkoutsHandled}</Text>
                                    <Text className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Salidas</Text>
                                </View>
                                <View className={`w-px h-full ${isDark ? 'bg-white/10' : 'bg-emerald-100'}`} />
                                <View className="flex-1 items-center justify-center">
                                    <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-800'}`}>{myStats.servicesDelivered}</Text>
                                    <Text className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Servicios</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View className={`p-6 rounded-3xl mt-4 border ${isDark ? 'bg-[#111111] border-white/10 shadow-xl' : 'bg-white border-zinc-200 shadow-md'}`}>
                        <View className="flex-row items-center mb-6">
                            <View className={`w-14 h-14 rounded-2xl items-center justify-center border ${isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-zinc-100'}`}>
                                <Clock color={isDark ? '#a1a1aa' : '#71717a'} size={28} />
                            </View>
                            <View className="ml-4 flex-1">
                                <Text className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>Sin Turno</Text>
                                {currentShift ? (
                                    <Text className={`text-xs font-medium mt-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                        Disponible: {currentShift.name}
                                    </Text>
                                ) : (
                                    <Text className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>No hay turnos asignados</Text>
                                )}
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={handleStartShift}
                            disabled={loading || !currentShift}
                            activeOpacity={0.8}
                            className={`h-16 items-center justify-center rounded-2xl border ${currentShift ? (isDark ? 'bg-emerald-600 border-emerald-500' : 'bg-emerald-600 border-emerald-700') : (isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-200 border-zinc-300')}`}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className={`font-black uppercase tracking-widest text-sm ${currentShift ? 'text-white' : (isDark ? 'text-zinc-600' : 'text-zinc-400')}`}>
                                    {currentShift ? `Iniciar Turno Ahora` : 'Turno no disponible'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Stats Grid - General */}
                <View className="flex-row gap-3 mt-6">
                    <View className={`flex-1 items-center p-4 rounded-2xl border shadow-sm ${isDark ? 'bg-blue-950/20 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
                        <View className={`w-10 h-10 rounded-full items-center justify-center mb-2 ${isDark ? 'bg-blue-500/20' : 'bg-blue-200'}`}>
                            <Car color={isDark ? '#60a5fa' : '#3b82f6'} size={20} />
                        </View>
                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-blue-400/80' : 'text-blue-600'}`}>Entradas</Text>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-blue-900'}`}>{stats.entries}</Text>
                    </View>
                    <View className={`flex-1 items-center p-4 rounded-2xl border shadow-sm ${isDark ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                        <View className={`w-10 h-10 rounded-full items-center justify-center mb-2 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-200'}`}>
                            <CheckCircle2 color={isDark ? '#34d399' : '#10b981'} size={20} />
                        </View>
                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-emerald-400/80' : 'text-emerald-600'}`}>En Garaje</Text>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-emerald-900'}`}>{stats.inStay}</Text>
                    </View>
                </View>
                <View className="flex-row gap-3 mt-3">
                    <View className={`flex-1 items-center p-4 rounded-2xl border shadow-sm ${stats.checkouts > 0 ? (isDark ? 'bg-red-950/40 border-red-500/40' : 'bg-red-100 border-red-300') : (isDark ? 'bg-[#111111] border-white/10' : 'bg-white border-zinc-200')}`}>
                        <View className={`w-10 h-10 rounded-full items-center justify-center mb-2 ${stats.checkouts > 0 ? (isDark ? 'bg-red-500/20' : 'bg-red-200') : (isDark ? 'bg-white/5' : 'bg-zinc-100')}`}>
                            <LogOut color={stats.checkouts > 0 ? (isDark ? '#f87171' : '#ef4444') : (isDark ? '#71717a' : '#a1a1aa')} size={20} />
                        </View>
                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${stats.checkouts > 0 ? (isDark ? 'text-red-400' : 'text-red-600') : (isDark ? 'text-zinc-500' : 'text-zinc-400')}`}>Salidas</Text>
                        <Text className={`text-2xl font-black ${stats.checkouts > 0 ? (isDark ? 'text-white' : 'text-red-900') : (isDark ? 'text-white' : 'text-zinc-900')}`}>{stats.checkouts}</Text>
                    </View>
                    <View className={`flex-1 items-center p-4 rounded-2xl border shadow-sm ${isDark ? 'bg-[#111111] border-white/10' : 'bg-white border-zinc-200'}`}>
                        <View className={`w-10 h-10 rounded-full items-center justify-center mb-2 ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                            <ShoppingBag color={stats.services > 0 ? (isDark ? '#fbbf24' : '#f59e0b') : (isDark ? '#71717a' : '#a1a1aa')} size={20} />
                        </View>
                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${stats.services > 0 ? (isDark ? 'text-amber-400/80' : 'text-amber-600') : (isDark ? 'text-zinc-500' : 'text-zinc-400')}`}>Servicios</Text>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{stats.services}</Text>
                    </View>
                </View>

                {/* Acciones Urgentes */}
                {urgentRooms.length > 0 && (
                    <View className="mt-8">
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center">
                                <View className="bg-red-500/20 p-1.5 rounded-lg border border-red-500/30 mr-2">
                                    <Zap color="#ef4444" size={16} strokeWidth={3} />
                                </View>
                                <Text className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                                    Atención Inmediata
                                </Text>
                            </View>
                        </View>
                        {urgentRooms.map((room) => (
                            <Animated.View key={room.stayId} style={{ transform: [{ scale: room.type === 'checkout' ? pulseAnim : 1 }] }}>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        router.push({
                                            pathname: '/(tabs)/rooms',
                                            params: {
                                                action: room.type,
                                                stayId: room.stayId
                                            }
                                        });
                                    }}
                                    className={`flex-row items-center justify-between p-4 rounded-2xl mb-3 border ${
                                        room.type === 'checkout'
                                            ? (isDark ? 'bg-red-950/40 border-red-500/30 shadow-[0_4px_20px_rgba(239,68,68,0.15)]' : 'bg-red-50 border-red-200 shadow-sm')
                                            : (isDark ? 'bg-blue-950/40 border-blue-500/30 shadow-[0_4px_20px_rgba(59,130,246,0.15)]' : 'bg-blue-50 border-blue-200 shadow-sm')
                                    }`}
                                >
                                    <View className="flex-row items-center">
                                        <View className={`w-12 h-12 rounded-xl items-center justify-center border ${
                                            room.type === 'checkout'
                                                ? (isDark ? 'bg-red-500/20 border-red-500/50' : 'bg-red-500 border-red-600')
                                                : (isDark ? 'bg-blue-500/20 border-blue-500/50' : 'bg-blue-500 border-blue-600')
                                        }`}>
                                            {room.type === 'checkout' ? (
                                                <LogOut color={isDark ? '#f87171' : 'white'} size={22} />
                                            ) : (
                                                <Car color={isDark ? '#60a5fa' : 'white'} size={22} />
                                            )}
                                        </View>
                                        <View className="ml-4">
                                            <Text className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                                Hab. {room.number}
                                            </Text>
                                            <Text className={`text-xs font-bold uppercase tracking-wider mt-0.5 ${
                                                room.type === 'checkout'
                                                    ? (isDark ? 'text-red-400' : 'text-red-600')
                                                    : (isDark ? 'text-blue-400' : 'text-blue-600')
                                            }`}>
                                                {room.label}
                                            </Text>
                                        </View>
                                    </View>
                                    <View className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-white/5' : 'bg-white'}`}>
                                        <ChevronRight color={room.type === 'checkout' ? '#ef4444' : '#3b82f6'} size={20} />
                                    </View>
                                </TouchableOpacity>
                            </Animated.View>
                        ))}
                    </View>
                )}

                {/* Quick Navigation */}
                <Text className={`text-xs font-black uppercase tracking-widest mt-8 mb-4 ml-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Navegación Rápida
                </Text>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/(tabs)/rooms')}
                    className={`flex-row items-center justify-between p-5 rounded-3xl mb-3 border shadow-sm ${isDark ? 'bg-[#111111] border-white/10' : 'bg-white border-zinc-200'}`}
                >
                    <View className="flex-row items-center">
                        <View className={`w-12 h-12 rounded-2xl items-center justify-center border ${isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-zinc-100'}`}>
                            <Car color={isDark ? '#a1a1aa' : '#52525b'} size={24} />
                        </View>
                        <View className="ml-4">
                            <Text className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>Habitaciones</Text>
                            <Text className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Entradas y salidas</Text>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        {stats.entries > 0 && (
                            <View className="bg-blue-500 px-3 py-1.5 rounded-full mr-3 shadow-md border border-blue-400">
                                <Text className="text-white text-xs font-black">{stats.entries} Nuevas</Text>
                            </View>
                        )}
                        <ChevronRight color={isDark ? '#52525b' : '#d4d4d8'} size={24} />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/(tabs)/services')}
                    className={`flex-row items-center justify-between p-5 rounded-3xl mb-3 border shadow-sm ${isDark ? 'bg-[#111111] border-white/10' : 'bg-white border-zinc-200'}`}
                >
                    <View className="flex-row items-center">
                        <View className={`w-12 h-12 rounded-2xl items-center justify-center border ${isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-zinc-100'}`}>
                            <ShoppingBag color={isDark ? '#fbbf24' : '#d97706'} size={24} />
                        </View>
                        <View className="ml-4">
                            <Text className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>Servicios</Text>
                            <Text className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Entregas de tienda</Text>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        {stats.services > 0 && (
                            <View className="bg-amber-500 px-3 py-1.5 rounded-full mr-3 shadow-md border border-amber-400">
                                <Text className="text-white text-xs font-black">{stats.services} Por llevar</Text>
                            </View>
                        )}
                        <ChevronRight color={isDark ? '#52525b' : '#d4d4d8'} size={24} />
                    </View>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}
