import React, { useState, useEffect } from 'react';
import MaskedView from '@react-native-masked-view/masked-view';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, useColorScheme, Dimensions, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Fingerprint, Lock, Mail, ChevronRight, Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSequence, withTiming, withRepeat, Easing } from 'react-native-reanimated';
import { Image } from 'expo-image';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';

    const [isBiometricSupported, setIsBiometricSupported] = useState(false);
    const [hasCredentials, setHasCredentials] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // --- ANIMACIÓN DE NEÓN (VOLTAJE) ---
    const neonOpacity = useSharedValue(0.1);
    
    useEffect(() => {
        neonOpacity.value = withSequence(
            withTiming(1, { duration: 50 }),
            withTiming(0.1, { duration: 50 }),
            withTiming(1, { duration: 50 }),
            withTiming(0.0, { duration: 120 }),
            withTiming(1, { duration: 300 }),
            // Respiración mucho más sutil y elegante
            withRepeat(
                withTiming(0.8, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
                -1, true
            )
        );
    }, []);

    const animatedNeonStyle = useAnimatedStyle(() => ({
        opacity: neonOpacity.value,
        transform: [{ scale: 1 - (1 - neonOpacity.value) * 0.02 }] 
    }));

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
            setError('Faltan credenciales');
            return;
        }

        setLoading(true);
        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: authEmail,
                password: authPwd,
            });

            if (authError) {
                setError('Credenciales incorrectas');
            } else {
                const { data: employee } = await supabase
                    .from('employees')
                    .select('role')
                    .eq('auth_user_id', data.user.id)
                    .single();

                if (!employee || !['admin', 'manager', 'superuser'].includes(employee.role.toLowerCase())) {
                    await supabase.auth.signOut();
                    setError('Acceso denegado (Solo Administradores)');
                    return;
                }

                if (!useSaved) {
                    await SecureStore.setItemAsync('luxor_admin_email', authEmail);
                    await SecureStore.setItemAsync('luxor_admin_password', authPwd);
                    setHasCredentials(true);
                }

                router.replace('/(chat)');
            }
        } catch {
            setError('Ocurrió un error inesperado');
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

    // Colores premium adaptados al tema
    const bgColors = isDark ? ['#09090b', '#000000'] as const : ['#f4f4f5', '#ffffff'] as const;
    const accent1 = isDark ? 'rgba(225, 29, 72, 0.15)' : 'rgba(225, 29, 72, 0.1)';
    const accent2 = isDark ? 'rgba(244, 63, 94, 0.1)' : 'rgba(244, 63, 94, 0.05)';
    const textColor = isDark ? 'text-white' : 'text-zinc-900';
    const subTextColor = isDark ? 'text-zinc-400' : 'text-zinc-500';

    // --- ANIMACIÓN DE FONDO (ESFERAS FLOTANTES) ---
    const sphere1X = useSharedValue(0);
    const sphere1Y = useSharedValue(0);
    const sphere1Scale = useSharedValue(1);
    const sphere2X = useSharedValue(0);
    const sphere2Y = useSharedValue(0);
    const sphere2Scale = useSharedValue(1);

    useEffect(() => {
        // Esfera 1: Movimiento extremo (atraviesa gran parte de la pantalla)
        sphere1X.value = withRepeat(withSequence(
            withTiming(width * 0.35, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
            withTiming(-width * 0.15, { duration: 4500, easing: Easing.inOut(Easing.ease) })
        ), -1, true);
        
        sphere1Y.value = withRepeat(withSequence(
            withTiming(height * 0.2, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
            withTiming(-height * 0.1, { duration: 4000, easing: Easing.inOut(Easing.ease) })
        ), -1, true);

        sphere1Scale.value = withRepeat(
            withTiming(1.4, { duration: 3500, easing: Easing.inOut(Easing.ease) }), 
            -1, true
        );

        // Esfera 2: Movimiento extremo en dirección opuesta
        sphere2X.value = withRepeat(withSequence(
            withTiming(-width * 0.4, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
            withTiming(width * 0.2, { duration: 5500, easing: Easing.inOut(Easing.ease) })
        ), -1, true);
        
        sphere2Y.value = withRepeat(withSequence(
            withTiming(-height * 0.25, { duration: 4500, easing: Easing.inOut(Easing.ease) }),
            withTiming(height * 0.15, { duration: 5000, easing: Easing.inOut(Easing.ease) })
        ), -1, true);

        sphere2Scale.value = withRepeat(
            withTiming(1.5, { duration: 4500, easing: Easing.inOut(Easing.ease) }), 
            -1, true
        );
    }, []);

    const sphere1Style = useAnimatedStyle(() => ({
        transform: [
            { translateX: sphere1X.value }, 
            { translateY: sphere1Y.value },
            { scale: sphere1Scale.value }
        ]
    }));

    const sphere2Style = useAnimatedStyle(() => ({
        transform: [
            { translateX: sphere2X.value }, 
            { translateY: sphere2Y.value },
            { scale: sphere2Scale.value }
        ]
    }));

    // --- ANIMACIÓN DE REFRACCIÓN (BRILLO EN EL CRISTAL) ---
    const shimmerX = useSharedValue(-width * 0.8);

    useEffect(() => {
        // Simulamos un rayo de luz que barre el cristal cada ciertos segundos
        shimmerX.value = withRepeat(
            withSequence(
                withTiming(width * 0.8, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
                withTiming(width * 0.8, { duration: 2000 }) // Pausa para que no maree
            ),
            -1, false // false para que siempre barra en la misma dirección
        );
    }, []);

    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: shimmerX.value },
            { rotate: '25deg' }
        ]
    }));

    return (
        <KeyboardAvoidingView
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
            className="flex-1"
        >
            <LinearGradient colors={bgColors} className="flex-1">
                {/* Esferas de fondo premium flotantes (Efecto Lámpara de Lava/Plasma) */}
                <Animated.View className="absolute top-[-10%] left-[-20%] w-[80vw] h-[80vw] rounded-full" style={[{ backgroundColor: accent1, filter: 'blur(60px)' }, sphere1Style]} />
                <Animated.View className="absolute bottom-[-10%] right-[-20%] w-[80vw] h-[80vw] rounded-full" style={[{ backgroundColor: accent2, filter: 'blur(60px)' }, sphere2Style]} />

                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    className="px-8 z-10"
                >
                    <Animated.View entering={FadeInDown.duration(800).springify()} className="items-center mb-12">
                        <View className="relative items-center justify-center mb-0 w-full px-4 py-8 overflow-hidden rounded-3xl">
                            {/* Arte Final de Neón Horneado con Animación de Voltaje Físico */}
                            <Animated.View style={[{ width: '100%', alignItems: 'center', zIndex: 10 }, animatedNeonStyle]}>
                                <Image
                                    source={require('../assets/images/luxor-neon.png')}
                                    style={{ width: '100%', height: 120 }}
                                    contentFit="contain"
                                />
                            </Animated.View>

                            {/* Refracción de Luz Enmascarada (Solo pinta el tubo físico) */}
                            <MaskedView
                                style={{ position: 'absolute', top: 32, width: '100%', height: 120, zIndex: 20 }}
                                maskElement={
                                    <View style={{ width: '100%', height: 120, alignItems: 'center', justifyContent: 'center' }}>
                                        <Image
                                            source={require('../assets/images/luxor-neon.png')}
                                            style={{ width: '100%', height: 120 }}
                                            contentFit="contain"
                                        />
                                    </View>
                                }
                            >
                                <Animated.View 
                                    style={[{ 
                                        position: 'absolute', 
                                        top: -50, 
                                        bottom: -50, 
                                        width: 100, 
                                        opacity: 0.8, // Súper brillante
                                    }, shimmerStyle]}
                                >
                                    <LinearGradient
                                        colors={['transparent', 'rgba(255,255,255,1)', 'transparent']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={{ flex: 1 }}
                                    />
                                </Animated.View>
                            </MaskedView>
                        </View>

                        <View className="bg-rose-500/10 px-4 py-1.5 rounded-full mt-2 border border-rose-500/20">
                            <Text className="text-xs font-bold uppercase tracking-[0.2em] text-rose-500">
                                Management Portal
                            </Text>
                        </View>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.duration(800).delay(200).springify()} className="gap-4">
                        {error && (
                            <Animated.View entering={FadeInDown} className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex-row items-center gap-3">
                                <View className="w-2 h-2 rounded-full bg-red-500" />
                                <Text className="text-red-500 text-xs font-bold flex-1">{error}</Text>
                            </Animated.View>
                        )}

                        <View className="gap-4">
                            <BlurView intensity={isDark ? 20 : 60} tint={isDark ? "dark" : "light"} className="rounded-3xl overflow-hidden border border-zinc-500/20">
                                <View className="flex-row items-center px-5 h-16">
                                    <Mail color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
                                    <TextInput
                                        value={email}
                                        onChangeText={setEmail}
                                        placeholder="admin@luxor.com"
                                        placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
                                        className={`flex-1 h-full font-semibold text-base ml-3 ${textColor}`}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                </View>
                            </BlurView>

                            <BlurView intensity={isDark ? 20 : 60} tint={isDark ? "dark" : "light"} className="rounded-3xl overflow-hidden border border-zinc-500/20">
                                <View className="flex-row items-center px-5 h-16">
                                    <Lock color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
                                    <TextInput
                                        value={password}
                                        onChangeText={setPassword}
                                        placeholder="Contraseña segura"
                                        placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
                                        className={`flex-1 h-full font-semibold text-base ml-3 ${textColor}`}
                                        secureTextEntry={!showPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
                                        {showPassword ? (
                                            <EyeOff color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
                                        ) : (
                                            <Eye color={isDark ? '#a1a1aa' : '#71717a'} size={20} />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </BlurView>
                        </View>

                        <TouchableOpacity
                            onPress={() => handleLogin(false)}
                            disabled={loading}
                            className="mt-6 rounded-3xl overflow-hidden shadow-rose-500/20 shadow-xl"
                        >
                            <LinearGradient
                                colors={['#e11d48', '#be123c']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                className="h-16 flex-row items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text className="font-black text-base uppercase tracking-widest text-white">
                                            Acceder
                                        </Text>
                                        <ChevronRight color="white" size={20} />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {isBiometricSupported && hasCredentials && (
                            <TouchableOpacity
                                onPress={handleBiometricLogin}
                                disabled={loading}
                                className="mt-2"
                            >
                                <BlurView intensity={isDark ? 30 : 60} tint={isDark ? "dark" : "light"} className="h-16 rounded-3xl flex-row items-center justify-center gap-3 border border-zinc-500/10">
                                    <Fingerprint size={22} color={isDark ? '#fb7185' : '#e11d48'} />
                                    <Text className={`font-bold text-sm tracking-widest ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                                        USAR BIOMETRÍA
                                    </Text>
                                </BlurView>
                            </TouchableOpacity>
                        )}
                    </Animated.View>
                </ScrollView>
            </LinearGradient>
        </KeyboardAvoidingView>
    );
}
