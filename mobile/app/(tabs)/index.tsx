import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserRole } from '../../hooks/use-user-role';
import { useTheme } from '../../contexts/theme-context';
import { useFeedback } from '../../contexts/feedback-context';
import { useValetActions } from '../../hooks/use-valet-actions';
import { Clock, CheckCircle2, Car, LogOut, ShoppingBag, RefreshCw, ChevronRight, DollarSign, Zap, AlertTriangle, TrendingUp } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
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
            const { data: rooms } = await supabase
                .from("rooms")
                .select(`
                    id, number,
                    room_stays!inner(
                        id, status, vehicle_plate, valet_employee_id,
                        checkout_valet_employee_id, vehicle_requested_at,
                        valet_checkout_requested_at
                    )
                `)
                .eq("room_stays.status", "ACTIVA");

            const activeRooms = rooms || [];

            const entries = activeRooms.filter(r => {
                const stay = (r as any).room_stays?.[0];
                return stay && !stay.vehicle_plate;
            });

            const inStay = activeRooms.filter(r => {
                const stay = (r as any).room_stays?.[0];
                return stay && stay.vehicle_plate && !stay.checkout_valet_employee_id;
            }).length;

            const urgents = activeRooms.filter(r => {
                const stay = (r as any).room_stays?.[0];
                return stay && stay.vehicle_plate && !stay.checkout_valet_employee_id &&
                    (stay.vehicle_requested_at || stay.valet_checkout_requested_at);
            });

            const { count: servicesCount } = await supabase
                .from('sales_order_items')
                .select('*', { count: 'exact', head: true })
                .eq('concept_type', 'CONSUMPTION')
                .eq('is_paid', false)
                .not('delivery_status', 'in', '("CANCELLED","COMPLETED","DELIVERED")');

            setStats({
                entries: entries.length,
                inStay,
                checkouts: urgents.length,
                services: servicesCount || 0
            });

            // Build urgent rooms list for quick actions (entries + urgent checkouts)
            const urgentList = [
                ...entries.map(r => ({
                    id: r.id,
                    number: (r as any).number,
                    stayId: (r as any).room_stays?.[0]?.id,
                    type: 'entry' as const,
                    label: 'Entrada pendiente'
                })),
                ...urgents.map(r => ({
                    id: r.id,
                    number: (r as any).number,
                    stayId: (r as any).room_stays?.[0]?.id,
                    type: 'checkout' as const,
                    label: (r as any).room_stays?.[0]?.valet_checkout_requested_at ? 'Revisión de salida' : 'Vehículo solicitado'
                }))
            ];
            setUrgentRooms(urgentList.slice(0, 5)); // Max 5

            // Personal stats (collected money in this shift)
            if (employeeId && hasActiveShift) {
                // Get active shift session to know start time
                const { data: session } = await supabase
                    .from('shift_sessions')
                    .select('clock_in_at')
                    .eq('employee_id', employeeId)
                    .in('status', ['active', 'open'])
                    .is('clock_out_at', null)
                    .order('clock_in_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (session?.clock_in_at) {
                    setShiftStartTime(session.clock_in_at);

                    // Payments collected by this employee during this shift
                    const { data: payments } = await supabase
                        .from('payments')
                        .select('amount')
                        .eq('collected_by', employeeId)
                        .gte('created_at', session.clock_in_at)
                        .eq('status', 'COMPLETADO');

                    const totalCollected = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

                    // Count my actions during shift
                    const { count: myEntries } = await supabase
                        .from('room_stays')
                        .select('id', { count: 'exact', head: true })
                        .eq('valet_employee_id', employeeId)
                        .gte('check_in_at', session.clock_in_at);

                    const { count: myCheckouts } = await supabase
                        .from('room_stays')
                        .select('id', { count: 'exact', head: true })
                        .eq('checkout_valet_employee_id', employeeId)
                        .gte('updated_at', session.clock_in_at);

                    const { count: myServices } = await supabase
                        .from('sales_order_items')
                        .select('id', { count: 'exact', head: true })
                        .eq('delivery_accepted_by', employeeId)
                        .in('delivery_status', ['DELIVERED', 'COMPLETED'])
                        .gte('delivery_completed_at', session.clock_in_at);

                    setMyStats({
                        totalCollected,
                        entriesHandled: myEntries || 0,
                        checkoutsHandled: myCheckouts || 0,
                        servicesDelivered: myServices || 0
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

        const channel = supabase.channel('dashboard-stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'room_stays' }, () => fetchStatsRef.current())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_order_items' }, () => fetchStatsRef.current())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchStatsRef.current())
            .subscribe();

        const interval = setInterval(() => fetchStatsRef.current(), 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, []);

    const fetchCurrentShift = async () => {
        const { data: shifts } = await supabase
            .from("shift_definitions")
            .select("*")
            .eq("is_active", true);

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
            const { error } = await supabase
                .from("shift_sessions")
                .insert({
                    employee_id: employeeId,
                    shift_definition_id: currentShift.id,
                    clock_in_at: new Date().toISOString(),
                    status: "active",
                });

            if (error) throw error;
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
            className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={isDark ? '#52525b' : '#a1a1aa'}
                />
            }
        >
            {/* Header con saludo personalizado */}
            <View className={`px-5 pt-4 pb-5 ${isDark ? 'bg-zinc-950' : 'bg-white'}`}>
                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <Text className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                            {getGreeting()}, {getFirstName(employeeName || '')}!
                        </Text>
                        <Text className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={onRefresh}
                        className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-zinc-900' : 'bg-zinc-100'}`}
                    >
                        <RefreshCw color={isDark ? '#71717a' : '#a1a1aa'} size={18} />
                    </TouchableOpacity>
                </View>
            </View>

            <View className="px-4 pb-8">
                {/* Tarjeta de Turno */}
                {hasActiveShift ? (
                    <View className={`p-5 rounded-3xl mt-4 border-2 ${isDark ? 'bg-emerald-950/50 border-emerald-800/50' : 'bg-emerald-50 border-emerald-100'}`}>
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center">
                                <View className={`w-10 h-10 rounded-2xl items-center justify-center ${isDark ? 'bg-emerald-900' : 'bg-emerald-100'}`}>
                                    <CheckCircle2 color="#10b981" size={22} />
                                </View>
                                <View className="ml-3">
                                    <Text className={`text-sm font-black uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Turno Activo</Text>
                                    {getElapsedTime() && (
                                        <Text className={`text-xs ${isDark ? 'text-emerald-500/70' : 'text-emerald-600/70'}`}>
                                            Hace {getElapsedTime()}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <View className={`px-3 py-1.5 rounded-full ${isDark ? 'bg-emerald-900/50' : 'bg-emerald-100'}`}>
                                <Text className={`text-xs font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                                    {totalActions} acciones
                                </Text>
                            </View>
                        </View>

                        {/* Money Stats */}
                        <View className={`p-4 rounded-2xl ${isDark ? 'bg-black/30' : 'bg-white/80'}`}>
                            <View className="flex-row items-center mb-3">
                                <DollarSign color={isDark ? '#10b981' : '#059669'} size={16} />
                                <Text className={`text-xs font-black uppercase tracking-widest ml-1 ${isDark ? 'text-emerald-500' : 'text-emerald-700'}`}>
                                    Recaudado este turno
                                </Text>
                            </View>
                            <Text className={`text-3xl font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                ${myStats.totalCollected.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </Text>
                            <View className="flex-row gap-3 mt-3">
                                <View className="flex-1">
                                    <Text className={`text-[10px] font-bold uppercase ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Entradas</Text>
                                    <Text className={`text-lg font-black ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{myStats.entriesHandled}</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className={`text-[10px] font-bold uppercase ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Salidas</Text>
                                    <Text className={`text-lg font-black ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{myStats.checkoutsHandled}</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className={`text-[10px] font-bold uppercase ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Servicios</Text>
                                    <Text className={`text-lg font-black ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{myStats.servicesDelivered}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View className={`p-6 rounded-3xl mt-4 border-2 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
                        <View className="flex-row items-center mb-5">
                            <View className={`w-12 h-12 rounded-2xl items-center justify-center ${isDark ? 'bg-zinc-800' : 'bg-zinc-50'}`}>
                                <Clock color={isDark ? '#a1a1aa' : '#71717a'} size={24} />
                            </View>
                            <View className="ml-4">
                                <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>Sin Turno Activo</Text>
                                {currentShift && (
                                    <Text className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                        Turno disponible: {currentShift.name}
                                    </Text>
                                )}
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={handleStartShift}
                            disabled={loading || !currentShift}
                            className={`h-14 items-center justify-center rounded-2xl ${currentShift ? 'bg-emerald-600' : (isDark ? 'bg-zinc-800' : 'bg-zinc-200')}`}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className={`font-black uppercase tracking-widest text-sm ${currentShift ? 'text-white' : (isDark ? 'text-zinc-500' : 'text-zinc-400')}`}>
                                    {currentShift ? `Iniciar Turno` : 'No hay turnos'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Stats Grid - General */}
                <View className="flex-row gap-2 mt-4">
                    <View className={`flex-1 items-center p-3.5 rounded-2xl border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-100'}`}>
                        <Car color={stats.entries > 0 ? '#3b82f6' : (isDark ? '#52525b' : '#a1a1aa')} size={20} />
                        <Text className={`text-[10px] font-bold mt-1.5 ${stats.entries > 0 ? (isDark ? 'text-blue-400' : 'text-blue-600') : (isDark ? 'text-zinc-600' : 'text-zinc-400')}`}>Entradas</Text>
                        <Text className={`text-xl font-black ${stats.entries > 0 ? (isDark ? 'text-blue-400' : 'text-blue-600') : (isDark ? 'text-zinc-600' : 'text-zinc-400')}`}>{stats.entries}</Text>
                    </View>
                    <View className={`flex-1 items-center p-3.5 rounded-2xl border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-100'}`}>
                        <CheckCircle2 color={isDark ? '#10b981' : '#059669'} size={20} />
                        <Text className={`text-[10px] font-bold mt-1.5 ${isDark ? 'text-emerald-500' : 'text-emerald-700'}`}>En Estancia</Text>
                        <Text className={`text-xl font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{stats.inStay}</Text>
                    </View>
                    <View className={`flex-1 items-center p-3.5 rounded-2xl border ${stats.checkouts > 0 ? (isDark ? 'bg-red-950/30 border-red-800/50' : 'bg-red-50 border-red-100') : (isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-100')}`}>
                        <LogOut color={stats.checkouts > 0 ? '#ef4444' : (isDark ? '#52525b' : '#a1a1aa')} size={20} />
                        <Text className={`text-[10px] font-bold mt-1.5 ${stats.checkouts > 0 ? 'text-red-500' : (isDark ? 'text-zinc-600' : 'text-zinc-400')}`}>Urgentes</Text>
                        <Text className={`text-xl font-black ${stats.checkouts > 0 ? 'text-red-500' : (isDark ? 'text-zinc-600' : 'text-zinc-400')}`}>{stats.checkouts}</Text>
                    </View>
                    <View className={`flex-1 items-center p-3.5 rounded-2xl border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-100'}`}>
                        <ShoppingBag color={stats.services > 0 ? '#f59e0b' : (isDark ? '#52525b' : '#a1a1aa')} size={20} />
                        <Text className={`text-[10px] font-bold mt-1.5 ${stats.services > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-zinc-600' : 'text-zinc-400')}`}>Servicios</Text>
                        <Text className={`text-xl font-black ${stats.services > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-zinc-600' : 'text-zinc-400')}`}>{stats.services}</Text>
                    </View>
                </View>

                {/* Acciones Urgentes */}
                {urgentRooms.length > 0 && (
                    <View className="mt-5">
                        <View className="flex-row items-center mb-3">
                            <Zap color="#ef4444" size={16} strokeWidth={3} />
                            <Text className={`text-xs font-black uppercase tracking-widest ml-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                                Requieren atención
                            </Text>
                        </View>
                        {urgentRooms.map((room) => (
                            <Animated.View key={room.stayId} style={{ transform: [{ scale: room.type === 'checkout' ? pulseAnim : 1 }] }}>
                                <TouchableOpacity
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
                                    className={`flex-row items-center justify-between p-4 rounded-2xl mb-2 border-2 ${
                                        room.type === 'checkout'
                                            ? (isDark ? 'bg-red-950/30 border-red-800/50' : 'bg-red-50 border-red-100')
                                            : (isDark ? 'bg-blue-950/30 border-blue-800/50' : 'bg-blue-50 border-blue-100')
                                    }`}
                                >
                                    <View className="flex-row items-center">
                                        <View className={`w-11 h-11 rounded-xl items-center justify-center ${
                                            room.type === 'checkout'
                                                ? 'bg-red-500'
                                                : 'bg-blue-500'
                                        }`}>
                                            {room.type === 'checkout' ? (
                                                <LogOut color="white" size={20} />
                                            ) : (
                                                <Car color="white" size={20} />
                                            )}
                                        </View>
                                        <View className="ml-3">
                                            <Text className={`text-base font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                                Hab. {room.number}
                                            </Text>
                                            <Text className={`text-xs ${
                                                room.type === 'checkout'
                                                    ? (isDark ? 'text-red-400' : 'text-red-600')
                                                    : (isDark ? 'text-blue-400' : 'text-blue-600')
                                            }`}>
                                                {room.label}
                                            </Text>
                                        </View>
                                    </View>
                                    <ChevronRight color={room.type === 'checkout' ? '#ef4444' : '#3b82f6'} size={20} />
                                </TouchableOpacity>
                            </Animated.View>
                        ))}
                    </View>
                )}

                {/* Quick Navigation */}
                <Text className={`text-xs font-black uppercase tracking-widest mt-6 mb-3 ml-1 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    Accesos Rápidos
                </Text>

                <TouchableOpacity
                    onPress={() => router.push('/(tabs)/rooms')}
                    className={`flex-row items-center justify-between p-4 rounded-2xl mb-2 border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-100'}`}
                >
                    <View className="flex-row items-center">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center ${isDark ? 'bg-zinc-800' : 'bg-zinc-50'}`}>
                            <Car color={isDark ? '#a1a1aa' : '#52525b'} size={20} />
                        </View>
                        <View className="ml-3">
                            <Text className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Habitaciones</Text>
                            <Text className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Entradas y salidas</Text>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        {stats.entries > 0 && (
                            <View className="bg-blue-500 px-2.5 py-1 rounded-full mr-2">
                                <Text className="text-white text-xs font-black">{stats.entries}</Text>
                            </View>
                        )}
                        <ChevronRight color={isDark ? '#3f3f46' : '#d4d4d8'} size={20} />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => router.push('/(tabs)/services')}
                    className={`flex-row items-center justify-between p-4 rounded-2xl mb-2 border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-100'}`}
                >
                    <View className="flex-row items-center">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center ${isDark ? 'bg-zinc-800' : 'bg-zinc-50'}`}>
                            <ShoppingBag color={isDark ? '#fbbf24' : '#d97706'} size={20} />
                        </View>
                        <View className="ml-3">
                            <Text className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Servicios</Text>
                            <Text className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Entregas de tienda</Text>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        {stats.services > 0 && (
                            <View className="bg-amber-500 px-2.5 py-1 rounded-full mr-2">
                                <Text className="text-white text-xs font-black">{stats.services}</Text>
                            </View>
                        )}
                        <ChevronRight color={isDark ? '#3f3f46' : '#d4d4d8'} size={20} />
                    </View>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}
