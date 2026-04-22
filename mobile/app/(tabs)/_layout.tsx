import { useEffect, useState, useCallback, useRef } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Home, LayoutDashboard, UserCircle, ShoppingBag } from 'lucide-react-native';
import { useTheme } from '../../contexts/theme-context';
import { supabase } from '../../lib/supabase';
import { SyncQueue } from '../../lib/sync-queue';
import { useUserRole } from '../../hooks/use-user-role';

export default function TabLayout() {
    const { isDark } = useTheme();
    const [pendingServiceCount, setPendingServiceCount] = useState(0);
    const [pendingEntryCount, setPendingEntryCount] = useState(0);
    const { role } = useUserRole();
    const router = useRouter();

    // Redirección de seguridad (Race-condition breaker)
    useEffect(() => {
        if (role === 'camarista') {
            router.replace('/camarista');
        }
    }, [role]);

    // Conteo liviano de servicios pendientes para el badge del tab
    const fetchPendingCount = useCallback(async () => {
        // Servicios pendientes
        const { count: serviceCount } = await supabase
            .from('sales_order_items')
            .select('id', { count: 'exact', head: true })
            .eq('concept_type', 'CONSUMPTION')
            .is('delivery_accepted_by', null)
            .eq('is_paid', false)
            .not('delivery_status', 'in', '("CANCELLED","COMPLETED","DELIVERED")');
        setPendingServiceCount(serviceCount || 0);

        // Habitaciones activas sin vehículo (pendientes de entrada)
        const { data: rooms } = await supabase
            .from("rooms")
            .select(`
                id,
                room_stays!inner(
                    id,
                    vehicle_plate,
                    valet_employee_id,
                    vehicle_requested_at,
                    valet_checkout_requested_at
                )
            `)
            .eq("room_stays.status", "ACTIVA");

        const activeRooms = rooms || [];
        const entries = activeRooms.filter(r => {
            const stay = (r as any).room_stays?.[0];
            return stay && !stay.vehicle_plate;
        }).length;
        const urgentCheckouts = activeRooms.filter(r => {
            const stay = (r as any).room_stays?.[0];
            return stay && stay.vehicle_plate && 
                (stay.vehicle_requested_at || stay.valet_checkout_requested_at);
        }).length;
        setPendingEntryCount(entries + urgentCheckouts);
    }, []);

    // Ref estable
    const fetchRef = useRef(fetchPendingCount);
    useEffect(() => { fetchRef.current = fetchPendingCount; }, [fetchPendingCount]);

    useEffect(() => {
        fetchRef.current();

        let timeout: NodeJS.Timeout;
        const debouncedFetch = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fetchRef.current(), 1500);
        };

        const channel = supabase.channel('tab-badge-counts')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_order_items' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'room_stays' }, debouncedFetch)
            .subscribe();

        // Limpiar la cola offline cada que vuelva la conexión
        const unsubscribeNetwork = SyncQueue.setupNetworkListener((count) => {
            console.log(`[Offline Sync] Auto-procesadas ${count} tareas al recuperar red`);
            fetchRef.current();
        });

        return () => {
            supabase.removeChannel(channel);
            clearTimeout(timeout);
            unsubscribeNetwork();
        };
    }, []); // Se monta una sola vez

    return (
        <Tabs screenOptions={{
            tabBarActiveTintColor: isDark ? '#ffffff' : '#09090b',
            tabBarInactiveTintColor: isDark ? '#71717a' : '#a1a1aa',
            tabBarStyle: {
                backgroundColor: isDark ? '#09090b' : '#fafafa',
                borderTopColor: isDark ? '#27272a' : '#e4e4e7',
                borderTopWidth: 1,
            },
            headerShown: true,
            headerStyle: {
                backgroundColor: isDark ? '#09090b' : '#fafafa',
                borderBottomWidth: 1,
                borderBottomColor: isDark ? '#27272a' : '#e4e4e7',
            },
            headerTitleStyle: {
                fontWeight: 'bold',
                color: isDark ? '#ffffff' : '#09090b',
            },
            headerTintColor: isDark ? '#ffffff' : '#09090b',
        }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Panel',
                    tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={24} />,
                    headerTitle: 'Luxor Cocheros',
                }}
            />
            <Tabs.Screen
                name="rooms"
                options={{
                    title: 'Habitaciones',
                    tabBarIcon: ({ color }) => <Home color={color} size={24} />,
                    headerTitle: 'Control de Habitaciones',
                    tabBarBadge: pendingEntryCount > 0 ? pendingEntryCount : undefined,
                    tabBarBadgeStyle: {
                        backgroundColor: '#3b82f6',
                        fontSize: 10,
                        fontWeight: '800',
                        minWidth: 18,
                        height: 18,
                        lineHeight: 18,
                    },
                }}
            />
            <Tabs.Screen
                name="services"
                options={{
                    title: 'Servicios',
                    tabBarIcon: ({ color }) => <ShoppingBag color={color} size={24} />,
                    headerTitle: 'Servicios de Tienda',
                    tabBarBadge: pendingServiceCount > 0 ? pendingServiceCount : undefined,
                    tabBarBadgeStyle: {
                        backgroundColor: '#ef4444',
                        fontSize: 10,
                        fontWeight: '800',
                        minWidth: 18,
                        height: 18,
                        lineHeight: 18,
                    },
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Perfil',
                    tabBarIcon: ({ color }) => <UserCircle color={color} size={24} />,
                    headerTitle: 'Mi Perfil',
                }}
            />
        </Tabs>
    );
}
