import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/theme-context';
import { useUserRole } from '../hooks/use-user-role';

/**
 * La app es solo para cocheros y camaristas; recepción y administración usan la versión web.
 * También llega aquí una cuenta sin empleado ligado (antes se quedaba en el spinner).
 */
export default function NoAccessScreen() {
    const router = useRouter();
    const { isDark } = useTheme();
    const { userEmail, role, refresh } = useUserRole();
    const [busy, setBusy] = useState(false);

    const logout = async () => {
        setBusy(true);
        await supabase.auth.signOut();
        router.replace('/login');
    };

    const retry = async () => {
        setBusy(true);
        await refresh();
        setBusy(false);
    };

    return (
        <View className={`flex-1 justify-center px-10 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
            <View className="items-center mb-8">
                <View className={`w-20 h-20 rounded-3xl items-center justify-center ${isDark ? 'bg-amber-500/15' : 'bg-amber-100'}`}>
                    <ShieldAlert color="#f59e0b" size={40} />
                </View>
                <Text className={`text-2xl font-black mt-6 text-center ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {role ? 'Esta app es para cocheros y camaristas' : 'Cuenta sin empleado'}
                </Text>
                <Text className={`text-sm mt-3 text-center ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {role
                        ? 'Recepción y administración trabajan desde la versión web del sistema.'
                        : `${userEmail || 'Esta cuenta'} no está ligada a un empleado activo. Pide a administración que la dé de alta.`}
                </Text>
            </View>

            {busy ? (
                <ActivityIndicator color={isDark ? '#fff' : '#000'} />
            ) : (
                <View className="gap-3">
                    {!role && (
                        <TouchableOpacity onPress={retry} className={`h-14 rounded-2xl items-center justify-center border-2 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                            <Text className={`font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-zinc-900'}`}>Reintentar</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={logout} className={`h-14 rounded-2xl items-center justify-center ${isDark ? 'bg-white' : 'bg-zinc-900'}`}>
                        <Text className={`font-black uppercase tracking-widest ${isDark ? 'text-zinc-900' : 'text-white'}`}>Cerrar sesión</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
