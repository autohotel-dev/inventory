import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';

try {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
} catch (error) {
    console.warn('[Push] No se pudo configurar el handler de notificaciones. Posiblemente usando Expo Go en SDK 53+');
}

export function usePushNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const notificationListener = useRef<any>(null);
    const responseListener = useRef<any>(null);
    const router = useRouter();

    useEffect(() => {
        let isMounted = true;

        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !isMounted) return;

            console.log('[Push] Iniciando registro para Admin');
            try {
                const token = await registerForPushNotificationsAsync();
                if (token) {
                    setExpoPushToken(token);
                    await savePushToken(user.id, token);
                }
            } catch (err) {
                console.error('[Push] Error registrando:', err);
            }
        };

        setup();

        try {
            notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
                console.log('Notificación recibida en primer plano:', notification.request.content.title);
            });

            responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
                const data = response.notification.request.content.data;
                console.log('Notificación tocada:', data);
                
                // Navegar al chat correspondiente
                if (data?.conversationId) {
                    router.push({
                        pathname: '/(chat)/room',
                        params: { conversationId: String(data.conversationId) }
                    });
                }
            });
        } catch (e) {
            console.warn('[Push] Error al configurar listeners de notificaciones:', e);
        }

        return () => {
            isMounted = false;
            try {
                if (notificationListener.current) notificationListener.current.remove();
                if (responseListener.current) responseListener.current.remove();
            } catch {}
        };
    }, [router]);

    return { expoPushToken };
}

async function registerForPushNotificationsAsync() {
    let token;
    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#10b981',
                sound: 'default',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                console.log('Failed to get push token for push notification!');
                return null;
            }

            const projectId = Constants.expoConfig?.extra?.eas?.projectId;
            if (projectId) {
                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            } else {
                token = (await Notifications.getExpoPushTokenAsync()).data;
            }
        } else {
            console.log('Must use physical device for Push Notifications');
        }
    } catch (e) {
        console.warn('[Push] Error al solicitar permisos de notificación (posible Expo Go limitation):', e);
    }

    return token;
}

async function savePushToken(authUserId: string, token: string) {
    try {
        const { error } = await supabase
            .from('employees')
            .update({ push_token: token, push_token_updated_at: new Date().toISOString() })
            .eq('auth_user_id', authUserId);

        if (error) {
            console.error('[Push] Error saving push token:', error);
        } else {
            console.log('[Push] Token guardado exitosamente');
        }
    } catch (error) {
        console.error('[Push] Error saving push token:', error);
    }
}
