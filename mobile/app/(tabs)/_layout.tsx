import { useEffect, useState, useCallback } from 'react';
import { Tabs } from 'expo-router';
import { Home, LayoutDashboard, UserCircle, ShoppingBag } from 'lucide-react-native';
import { useTheme } from '../../contexts/theme-context';
import { supabase } from '../../lib/supabase';

export default function TabLayout() {
    const { isDark } = useTheme();
    const [pendingServiceCount, setPendingServiceCount] = useState(0);

    // Conteo liviano de servicios pendientes para el badge del tab
    const fetchPendingCount = useCallback(async () => {
        const { count } = await supabase
            .from('sales_order_items')
            .select('id', { count: 'exact', head: true })
            .eq('concept_type', 'CONSUMPTION')
            .is('delivery_accepted_by', null)
            .eq('is_paid', false)
            .not('delivery_status', 'in', '("CANCELLED","COMPLETED","DELIVERED")');
        setPendingServiceCount(count || 0);
    }, []);

    useEffect(() => {
        fetchPendingCount();

        let timeout: NodeJS.Timeout;
        const debouncedFetch = () => {
            clearTimeout(timeout);
            timeout = setTimeout(fetchPendingCount, 1500);
        };

        const channel = supabase.channel('tab-badge-services')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_order_items' }, debouncedFetch)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            clearTimeout(timeout);
        };
    }, [fetchPendingCount]);

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
