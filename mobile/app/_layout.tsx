import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, useSegments } from 'expo-router';
import { useUserRole } from '../hooks/use-user-role';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { ThemeProvider, useTheme } from '../contexts/theme-context';
import { FeedbackProvider } from '../contexts/feedback-context';
import { ConfirmProvider } from '../contexts/confirm-context';
import { InAppNotificationProvider } from '../contexts/in-app-notification-context';
import { useNotifications } from '../hooks/use-notifications';
import { OfflineBanner } from '../components/OfflineBanner';
import { GlobalErrorBoundary } from '../components/GlobalErrorBoundary';
import "../global.css";

function RootLayoutNav() {
    const segments = useSegments();
    const router = useRouter();
    const { isDark } = useTheme();
    const { role, employeeId, isLoading: roleLoading } = useUserRole();

    // Inicializar notificaciones push
    useNotifications(employeeId);

    // === NAVEGACIÓN BASADA EN ROL ===
    useEffect(() => {
        if (roleLoading) return;

        supabase.auth.getSession().then(({ data: { session } }) => {
            const seg = segments[0];

            if (!session) {
                if (seg !== 'login') {
                    router.replace('/login');
                }
                return;
            }

            // Hay sesión activa — redirigir según rol
            if (role === 'camarista') {
                if (seg !== 'camarista') {
                    router.replace('/camarista');
                }
            } else if (role) {
                if (seg === 'login' || !seg || seg === '' || seg === 'camarista') {
                    router.replace('/(tabs)');
                }
            }
        });

        // Escuchar cambios de auth (login/logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                router.replace('/login');
            }
        });

        return () => subscription.unsubscribe();
    }, [role, roleLoading, segments]);

    return (
        <View className="flex-1" style={{ backgroundColor: isDark ? '#09090b' : '#fafafa' }}>
            <Stack screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: isDark ? '#09090b' : '#fafafa' }
            }}>
                <Stack.Screen name="index" options={{ title: 'Inicio' }} />
                <Stack.Screen name="login" options={{ title: 'Iniciar Sesión' }} />
                <Stack.Screen name="(tabs)" options={{ title: 'Panel Cocheros' }} />
                <Stack.Screen name="camarista" options={{ title: 'Panel Camarista' }} />
            </Stack>
        </View>
    );
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <GlobalErrorBoundary>
                <ThemeProvider>
                    <FeedbackProvider>
                        <ConfirmProvider>
                            <InAppNotificationProvider>
                                <OfflineBanner />
                                <RootLayoutNav />
                            </InAppNotificationProvider>
                        </ConfirmProvider>
                    </FeedbackProvider>
                </ThemeProvider>
            </GlobalErrorBoundary>
        </SafeAreaProvider>
    );
}
