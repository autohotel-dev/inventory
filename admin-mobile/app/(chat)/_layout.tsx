import { Stack } from 'expo-router';
import { usePushNotifications } from '../../hooks/use-push-notifications';
import { useColorScheme } from 'react-native';

export default function ChatLayout() {
    // Inicializar push notifications si el usuario está logueado
    usePushNotifications();
    const isDark = useColorScheme() === 'dark';

    return (
        <Stack screenOptions={{ 
            headerStyle: { backgroundColor: isDark ? '#09090b' : '#ffffff' },
            headerTintColor: isDark ? '#ffffff' : '#000000',
            headerShadowVisible: false,
        }}>
            <Stack.Screen 
                name="index" 
                options={{ 
                    headerShown: false,
                }} 
            />
            <Stack.Screen 
                name="room" 
                options={{ 
                    title: 'Chat',
                    headerBackTitle: 'Atrás'
                }} 
            />
        </Stack>
    );
}
