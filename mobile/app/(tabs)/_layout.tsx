import { useEffect, useState, useCallback, useRef } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Home, LayoutDashboard, UserCircle, ShoppingBag, Tv } from 'lucide-react-native';
import { useTheme } from '../../contexts/theme-context';
import { apiClient } from '../../lib/api/client';
import { useRealtimeSubscription } from '../../lib/api/websocket';
import { SyncQueue } from '../../lib/sync-queue';
import { useUserRole } from '../../hooks/use-user-role';

export default function TabLayout() {
    const { isDark } = useTheme();
    const [pendingServiceCount, setPendingServiceCount] = useState(0);
    const [pendingEntryCount, setPendingEntryCount] = useState(0);
    const [pendingTvCount, setPendingTvCount] = useState(0);
    const { role, employeeId } = useUserRole();
    const router = useRouter();

    // Redirección de seguridad (Race-condition breaker)
    useEffect(() => {
        if (role === 'camarista') {
            router.replace('/camarista');
        }
    }, [role]);

    // Conteo liviano de servicios pendientes para el badge del tab
    const fetchPendingCount = useCallback(async () => {
        try {
            // Servicios pendientes
            const resServices = await apiClient.get('/system/crud/sales_order_items', {
                params: {
                    concept_type: 'eq.CONSUMPTION',
                    delivery_accepted_by: 'is.null',
                    is_paid: 'eq.false',
                    delivery_status: 'not.in.(CANCELLED,COMPLETED,DELIVERED)'
                }
            });
            setPendingServiceCount(resServices.data?.length || 0);

            // Habitaciones activas sin vehículo (pendientes de entrada)
            const resRooms = await apiClient.get('/rooms/active-stays'); // Un nuevo endpoint o consulta adaptada
            // Como no tenemos PostgREST directo igual que Supabase, llamaremos a active-stays si existe
            // O usaremos /system/crud/room_stays?status=eq.ACTIVA
            const resStays = await apiClient.get('/system/crud/room_stays', {
                params: { status: 'eq.ACTIVA' }
            });

            const activeStays = resStays.data || [];
            const entries = activeStays.filter((stay: any) => !stay.vehicle_plate).length;
            const urgentCheckouts = activeStays.filter((stay: any) => stay.vehicle_plate && 
                (stay.vehicle_requested_at || stay.valet_checkout_requested_at)).length;
            setPendingEntryCount(entries + urgentCheckouts);

            // TVs pendientes
            if (employeeId) {
                const resTvs = await apiClient.get('/system/crud/room_assets', {
                    params: {
                        asset_type: 'eq.TV_REMOTE',
                        status: 'eq.PENDIENTE_ENCENDIDO',
                        assigned_employee_id: `eq.${employeeId}`
                    }
                });
                setPendingTvCount(resTvs.data?.length || 0);
            }
        } catch (error) {
            console.error("Error fetching pending counts:", error);
        }
    }, [employeeId]);

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

        const unsubscribeWS = useRealtimeSubscription('global', () => {
            // Recargamos en cualquier actualización en el WS
            debouncedFetch();
        });

        // Limpiar la cola offline cada que vuelva la conexión
        const unsubscribeNetwork = SyncQueue.setupNetworkListener((count) => {
            console.log(`[Offline Sync] Auto-procesadas ${count} tareas al recuperar red`);
            fetchRef.current();
        });

        return () => {
            unsubscribeWS();
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
                name="assets"
                options={{
                    title: 'Controles',
                    tabBarIcon: ({ color }) => <Tv color={color} size={24} />,
                    headerTitle: 'Inventario de Controles',
                    tabBarBadge: pendingTvCount > 0 ? pendingTvCount : undefined,
                    tabBarBadgeStyle: {
                        backgroundColor: '#f59e0b',
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
