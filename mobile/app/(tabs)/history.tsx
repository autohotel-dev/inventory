import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/use-user-role';
import { useTheme } from '../../contexts/theme-context';
import { Clock, Car, Package, DollarSign, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Skeleton } from '../../components/Skeleton';

interface HistoryEntry {
    id: string;
    type: 'entry' | 'checkout' | 'delivery' | 'damage' | 'extra';
    roomNumber: string;
    description: string;
    amount?: number;
    timestamp: string;
    status: string;
}

export default function HistoryScreen() {
    const { employeeId, isLoading: roleLoading } = useUserRole();
    const { isDark } = useTheme();
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'all' | 'entry' | 'checkout' | 'delivery'>('all');
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const fetchHistory = useCallback(async () => {
        if (!employeeId) {
            setLoading(false);
            return;
        }

        try {
            const entries: HistoryEntry[] = [];

            // Fetch entries (check-ins)
            const { data: stays } = await supabase
                .from('room_stays')
                .select(`
                    id, check_in_at, vehicle_plate, status,
                    rooms(number),
                    sales_orders(payments(amount, payment_method, status))
                `)
                .eq('valet_employee_id', employeeId)
                .order('check_in_at', { ascending: false })
                .limit(50);

            if (stays) {
                stays.forEach(stay => {
                    const totalPaid = stay.sales_orders?.payments
                        ?.filter((p: any) => p.status === 'PAGADO' || p.status === 'COBRADO_POR_VALET')
                        ?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0;

                    entries.push({
                        id: stay.id,
                        type: 'entry',
                        roomNumber: (stay as any).rooms?.number || '??',
                        description: `Entrada - ${stay.vehicle_plate || 'Sin placa'}`,
                        amount: totalPaid,
                        timestamp: stay.check_in_at,
                        status: stay.status
                    });
                });
            }

            // Fetch checkouts
            const { data: checkouts } = await supabase
                .from('room_stays')
                .select(`
                    id, actual_check_out_at, vehicle_plate, status,
                    rooms(number)
                `)
                .eq('checkout_valet_employee_id', employeeId)
                .not('actual_check_out_at', 'is', null)
                .order('actual_check_out_at', { ascending: false })
                .limit(50);

            if (checkouts) {
                checkouts.forEach(stay => {
                    entries.push({
                        id: `checkout-${stay.id}`,
                        type: 'checkout',
                        roomNumber: (stay as any).rooms?.number || '??',
                        description: `Salida - ${stay.vehicle_plate || 'Sin placa'}`,
                        timestamp: stay.actual_check_out_at!,
                        status: 'completed'
                    });
                });
            }

            // Fetch deliveries
            const { data: deliveries } = await supabase
                .from('sales_order_items')
                .select(`
                    id, qty, total, concept_type, delivery_completed_at, delivery_status,
                    products(name),
                    sales_orders(room_stays(rooms(number)))
                `)
                .eq('delivery_accepted_by', employeeId)
                .not('delivery_completed_at', 'is', null)
                .order('delivery_completed_at', { ascending: false })
                .limit(50);

            if (deliveries) {
                deliveries.forEach(item => {
                    entries.push({
                        id: `delivery-${item.id}`,
                        type: 'delivery',
                        roomNumber: (item as any).sales_orders?.room_stays?.[0]?.rooms?.number || '??',
                        description: `${item.qty}x ${(item as any).products?.name || 'Producto'}`,
                        amount: Number(item.total || 0),
                        timestamp: item.delivery_completed_at!,
                        status: item.delivery_status || 'DELIVERED'
                    });
                });
            }

            // Sort by timestamp
            entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            setHistory(entries);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchHistory();
        setRefreshing(false);
    };

    const filteredHistory = filter === 'all' ? history : history.filter(h => h.type === filter);

    const toggleExpanded = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'entry': return <Car size={16} color="#3b82f6" />;
            case 'checkout': return <CheckCircle2 size={16} color="#10b981" />;
            case 'delivery': return <Package size={16} color="#f59e0b" />;
            default: return <Clock size={16} color="#6b7280" />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'entry': return isDark ? 'bg-blue-950/50 border-blue-800' : 'bg-blue-50 border-blue-200';
            case 'checkout': return isDark ? 'bg-emerald-950/50 border-emerald-800' : 'bg-emerald-50 border-emerald-200';
            case 'delivery': return isDark ? 'bg-amber-950/50 border-amber-800' : 'bg-amber-50 border-amber-200';
            default: return isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200';
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 24) {
            return `Hoy ${date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffHours < 48) {
            return `Ayer ${date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        }
    };

    if (loading || roleLoading) {
        return (
            <View className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
                <View className="p-4 gap-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} height={80} />
                    ))}
                </View>
            </View>
        );
    }

    return (
        <View className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
            {/* Header */}
            <View className="px-5 pt-5 pb-3">
                <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>Mi Historial</Text>
                <Text className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{filteredHistory.length} registros</Text>
            </View>

            {/* Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5 pb-4" contentContainerStyle={{ gap: 10 }}>
                {[
                    { key: 'all', label: 'Todos', icon: Clock, activeColor: 'bg-violet-600', activeBorder: 'border-violet-500' },
                    { key: 'entry', label: 'Entradas', icon: Car, activeColor: 'bg-blue-600', activeBorder: 'border-blue-500' },
                    { key: 'checkout', label: 'Salidas', icon: CheckCircle2, activeColor: 'bg-emerald-600', activeBorder: 'border-emerald-500' },
                    { key: 'delivery', label: 'Entregas', icon: Package, activeColor: 'bg-amber-600', activeBorder: 'border-amber-500' },
                ].map(({ key, label, icon: Icon, activeColor, activeBorder }) => {
                    const isActive = filter === key;
                    return (
                        <TouchableOpacity
                            key={key}
                            onPress={() => {
                                Haptics.selectionAsync();
                                setFilter(key as any);
                            }}
                            activeOpacity={0.7}
                            className={`px-5 py-3 rounded-2xl flex-row items-center gap-2.5 border-2 ${
                                isActive
                                    ? `${activeColor} ${activeBorder}`
                                    : (isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')
                            }`}
                            style={isActive ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 } : {}}
                        >
                            <Icon size={18} color={isActive ? '#fff' : (isDark ? '#a1a1aa' : '#71717a')} />
                            <Text className={`font-extrabold text-sm ${isActive ? 'text-white' : (isDark ? 'text-zinc-300' : 'text-zinc-700')}`}>{label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* History List */}
            <ScrollView
                className="flex-1 px-5"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                {filteredHistory.length === 0 ? (
                    <View className="items-center justify-center py-20">
                        <Clock size={48} color={isDark ? '#3f3f46' : '#d4d4d8'} />
                        <Text className={`mt-4 font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Sin registros</Text>
                        <Text className={`text-sm mt-1 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Tus acciones aparecerán aquí</Text>
                    </View>
                ) : (
                    <View className="gap-2 pb-8">
                        {filteredHistory.map((entry) => (
                            <TouchableOpacity
                                key={entry.id}
                                onPress={() => toggleExpanded(entry.id)}
                                className={`rounded-2xl border-2 overflow-hidden ${getTypeColor(entry.type)}`}
                            >
                                <View className="p-4 flex-row items-center gap-3">
                                    <View className={`w-10 h-10 rounded-xl items-center justify-center ${
                                        isDark ? 'bg-zinc-800' : 'bg-white'
                                    }`}>
                                        {getTypeIcon(entry.type)}
                                    </View>
                                    <View className="flex-1">
                                        <View className="flex-row items-center gap-2">
                                            <Text className={`font-black text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                                Hab. {entry.roomNumber}
                                            </Text>
                                            <Text className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                                {formatTime(entry.timestamp)}
                                            </Text>
                                        </View>
                                        <Text className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                            {entry.description}
                                        </Text>
                                    </View>
                                    {entry.amount && entry.amount > 0 && (
                                        <Text className="font-black text-emerald-500">${entry.amount.toFixed(0)}</Text>
                                    )}
                                    {expandedItems.has(entry.id) ? (
                                        <ChevronUp size={16} color={isDark ? '#71717a' : '#a1a1aa'} />
                                    ) : (
                                        <ChevronDown size={16} color={isDark ? '#71717a' : '#a1a1aa'} />
                                    )}
                                </View>

                                {expandedItems.has(entry.type) && (
                                    <View className={`px-4 pb-4 pt-2 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                                        <View className="flex-row justify-between">
                                            <Text className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Estado</Text>
                                            <Text className={`text-xs font-bold ${
                                                entry.status === 'ACTIVA' ? 'text-amber-500' :
                                                entry.status === 'FINALIZADA' || entry.status === 'completed' ? 'text-emerald-500' :
                                                'text-zinc-500'
                                            }`}>
                                                {entry.status === 'ACTIVA' ? 'En curso' :
                                                 entry.status === 'FINALIZADA' || entry.status === 'completed' ? 'Completado' :
                                                 entry.status}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
