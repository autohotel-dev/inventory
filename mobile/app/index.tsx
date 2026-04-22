import { View, ActivityIndicator, Text } from 'react-native';

/**
 * Pantalla raíz — Solo muestra un spinner.
 * TODA la lógica de navegación está en _layout.tsx.
 * Esta pantalla existe únicamente como ruta inicial requerida por Expo Router.
 */
export default function Index() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b' }}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={{ color: '#71717a', marginTop: 12, fontSize: 11 }}>Cargando...</Text>
        </View>
    );
}
