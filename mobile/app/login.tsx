import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, useColorScheme, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFeedback } from '../contexts/feedback-context';
import { useConfirm } from '../contexts/confirm-context';
import * as Updates from 'expo-updates';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';
    const { showFeedback } = useFeedback();
    const { showConfirm } = useConfirm();

    const [isBiometricSupported, setIsBiometricSupported] = useState(false);
    const [hasCredentials, setHasCredentials] = useState(false);

    useEffect(() => {
        async function checkUpdates() {
            try {
                const update = await Updates.checkForUpdateAsync();
                if (update.isAvailable) {
                    await Updates.fetchUpdateAsync();
                    showConfirm(
                        "Actualización Disponible",
                        "Se descargó una nueva versión. La aplicación se reiniciará.",
                        () => Updates.reloadAsync(),
                        { type: 'info', confirmText: 'Reiniciar Ahora', cancelText: 'Más tarde' }
                    );
                }
            } catch (error) {
                console.log("Error checking updates:", error);
            }
        }
        
        async function checkBiometrics() {
            const compatible = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            if (compatible && enrolled) {
                setIsBiometricSupported(true);
            }
            
            const savedEmail = await SecureStore.getItemAsync('luxor_valet_email');
            const savedPwd = await SecureStore.getItemAsync('luxor_valet_password');
            if (savedEmail && savedPwd) {
                setHasCredentials(true);
            }
        }
        
        checkUpdates();
        checkBiometrics();
    }, []);

    const handleLogin = async (useSaved = false) => {
        let authEmail = email;
        let authPwd = password;

        if (useSaved) {
            const savedEmail = await SecureStore.getItemAsync('luxor_valet_email');
            const savedPwd = await SecureStore.getItemAsync('luxor_valet_password');
            if (!savedEmail || !savedPwd) {
                showFeedback('Error', 'Credenciales no encontradas', 'error');
                return;
            }
            authEmail = savedEmail;
            authPwd = savedPwd;
        }

        if (!authEmail || !authPwd) {
            showFeedback('Datos incompletos', 'Por favor ingresa correo y contraseña', 'warning');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: authEmail,
                password: authPwd,
            });

            if (error) {
                showFeedback('Error de acceso', error.message, 'error');
            } else {
                if (!useSaved) {
                    await SecureStore.setItemAsync('luxor_valet_email', authEmail);
                    await SecureStore.setItemAsync('luxor_valet_password', authPwd);
                    setHasCredentials(true);
                }
                // Delegamos la navegación al RootLayoutNav que checa el role.
            }
        } catch (err: any) {
            showFeedback('Error', 'Ocurrió un error inesperado al intentar entrar.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBiometricLogin = async () => {
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Entrar a Luxor Valet',
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
                        <ShieldCheck color={isDark ? '#000' : '#fff'} size={48} strokeWidth={2.5} />
                    </View>
                    <Text className={`text-4xl font-black mt-8 tracking-tighter ${isDark ? 'text-white' : 'text-zinc-900'}`}>LUXOR</Text>
                    <Text className={`text-xs font-black uppercase tracking-[0.3em] mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Sistema de Cocheros</Text>
                </View>

                <View className="gap-5">
                    <View>
                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-2 ml-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Correo Electrónico</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="usuario@autohotelluxor.com"
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
                            <Text className={`font-black uppercase tracking-widest ${isDark ? 'text-zinc-900' : 'text-white'}`}>Entrar al Turno</Text>
                        )}
                    </TouchableOpacity>

                    {isBiometricSupported && hasCredentials && (
                        <TouchableOpacity
                            onPress={handleBiometricLogin}
                            disabled={loading}
                            className={`rounded-2xl h-16 items-center justify-center mt-2 border-2 ${isDark ? 'border-zinc-800' : 'border-zinc-200'} bg-transparent`}
                        >
                            <Text className={`font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-zinc-900'}`}>Usar Biometría</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View className="absolute bottom-12 left-0 right-0 items-center">
                    <Text className={`text-[10px] font-bold ${isDark ? 'text-zinc-700' : 'text-zinc-300'}`}>AHLM v2.0 • LUXOR MANAGER</Text>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
