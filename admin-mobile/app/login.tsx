import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, useColorScheme } from 'react-native';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Fingerprint } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';

    const [isBiometricSupported, setIsBiometricSupported] = useState(false);
    const [hasCredentials, setHasCredentials] = useState(false);

    useEffect(() => {
        async function checkBiometrics() {
            const compatible = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            if (compatible && enrolled) {
                setIsBiometricSupported(true);
            }
            
            const savedEmail = await SecureStore.getItemAsync('luxor_admin_email');
            const savedPwd = await SecureStore.getItemAsync('luxor_admin_password');
            if (savedEmail && savedPwd) {
                setHasCredentials(true);
            }
        }
        
        checkBiometrics();
    }, []);

    const handleLogin = async (useSaved = false) => {
        let authEmail = email;
        let authPwd = password;
        setError(null);

        if (useSaved) {
            const savedEmail = await SecureStore.getItemAsync('luxor_admin_email');
            const savedPwd = await SecureStore.getItemAsync('luxor_admin_password');
            if (!savedEmail || !savedPwd) {
                setError('Credenciales no encontradas');
                return;
            }
            authEmail = savedEmail;
            authPwd = savedPwd;
        }

        if (!authEmail || !authPwd) {
            setError('Por favor ingresa correo y contraseña');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: authEmail,
                password: authPwd,
            });

            if (error) {
                setError(error.message);
            } else {
                // Verificar si es admin
                const { data: employee } = await supabase
                    .from('employees')
                    .select('role')
                    .eq('auth_user_id', data.user.id)
                    .single();

                if (!employee || !['admin', 'manager', 'superuser'].includes(employee.role.toLowerCase())) {
                    await supabase.auth.signOut();
                    setError('Acceso denegado. Esta app es solo para administradores.');
                    return;
                }

                if (!useSaved) {
                    await SecureStore.setItemAsync('luxor_admin_email', authEmail);
                    await SecureStore.setItemAsync('luxor_admin_password', authPwd);
                    setHasCredentials(true);
                }
                
                router.replace('/(chat)');
            }
        } catch (err: any) {
            setError('Ocurrió un error inesperado al intentar entrar.');
        } finally {
            setLoading(false);
        }
    };

    const handleBiometricLogin = async () => {
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Entrar a Luxor Admin',
            cancelLabel: 'Cancelar',
            disableDeviceFallback: false,
        });

        if (result.success) {
            await handleLogin(true);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}
        >
            <View className="flex-1 justify-center px-10">
                <View className="items-center mb-16">
                    <View className={`w-24 h-24 rounded-3xl items-center justify-center shadow-2xl ${isDark ? 'bg-white' : 'bg-zinc-900'}`}>
                        <ShieldAlert color={isDark ? '#000' : '#fff'} size={48} strokeWidth={2.5} />
                    </View>
                    <Text className={`text-4xl font-black mt-8 tracking-tighter ${isDark ? 'text-white' : 'text-zinc-900'}`}>LUXOR</Text>
                    <Text className={`text-xs font-black uppercase tracking-[0.3em] mt-2 text-emerald-500`}>Admin Communications</Text>
                </View>

                <View className="gap-5">
                    {error && (
                        <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                            <Text className="text-red-500 text-xs font-bold text-center">{error}</Text>
                        </View>
                    )}

                    <View>
                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-2 ml-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Correo Administrador</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="admin@autohotelluxor.com"
                            placeholderTextColor={isDark ? '#3f3f46' : '#d4d4d8'}
                            className={`border-2 rounded-2xl px-5 py-4 font-bold text-lg ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-100 text-zinc-900'}`}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View>
                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-2 ml-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Contraseña</Text>
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            placeholderTextColor={isDark ? '#3f3f46' : '#d4d4d8'}
                            className={`border-2 rounded-2xl px-5 py-4 font-bold text-lg ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-100 text-zinc-900'}`}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        onPress={() => handleLogin(false)}
                        disabled={loading}
                        className={`rounded-2xl h-16 items-center justify-center mt-6 shadow-xl ${isDark ? 'bg-white' : 'bg-zinc-900'}`}
                    >
                        {loading ? (
                            <ActivityIndicator color={isDark ? 'black' : 'white'} />
                        ) : (
                            <Text className={`font-black uppercase tracking-widest ${isDark ? 'text-zinc-900' : 'text-white'}`}>Entrar al Panel</Text>
                        )}
                    </TouchableOpacity>

                    {isBiometricSupported && hasCredentials && (
                        <TouchableOpacity
                            onPress={handleBiometricLogin}
                            disabled={loading}
                            className={`rounded-2xl h-16 flex-row gap-3 items-center justify-center mt-2 border-2 ${isDark ? 'border-zinc-800' : 'border-zinc-200'} bg-transparent`}
                        >
                            <Fingerprint size={20} color={isDark ? '#fff' : '#000'} />
                            <Text className={`font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-zinc-900'}`}>Usar Biometría</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
