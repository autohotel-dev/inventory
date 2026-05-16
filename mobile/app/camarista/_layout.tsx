import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTheme } from '../../contexts/theme-context';
import { supabase } from '../../lib/supabase';
import { TouchableOpacity, View, Text, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { LogOut, UserCircle, RefreshCw, Sun, Moon, Smartphone, Wifi, X } from 'lucide-react-native';
import { useUserRole } from '../../hooks/use-user-role';
import { useConfirm } from '../../contexts/confirm-context';
import { useFeedback } from '../../contexts/feedback-context';
import * as Updates from 'expo-updates';

export default function CamaristaLayout() {
    const { isDark, themeMode, setThemeMode } = useTheme();
    const router = useRouter();
    const { employeeName, userEmail, role, hasActiveShift, employeeId } = useUserRole();
    const [profileVisible, setProfileVisible] = useState(false);
    const [checking, setChecking] = useState(false);
    const { showConfirm } = useConfirm();
    const { showFeedback } = useFeedback();

    const handleLogout = () => {
        showConfirm(
            "Cerrar Sesión",
            "¿Estás seguro de que deseas salir?",
            async () => {
                try {
                    if (hasActiveShift && employeeId) {
                        await supabase
                            .from("shift_sessions")
                            .update({
                                clock_out_at: new Date().toISOString(),
                                status: "closed",
                            })
                            .eq("employee_id", employeeId)
                            .in("status", ["active", "open"])
                            .is("clock_out_at", null);
                    }
                } catch (error) {
                    console.error("Error auto-closing shift:", error);
                } finally {
                    setProfileVisible(false);
                    await supabase.auth.signOut();
                    router.replace('/login');
                }
            },
            { type: 'danger', confirmText: 'Salir', cancelText: 'Cancelar' }
        );
    };

    const handleCheckUpdate = async () => {
        if (checking) return;
        setChecking(true);
        try {
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
                showConfirm(
                    "Actualización Disponible",
                    "Se encontró una nueva versión. ¿Deseas instalarla ahora?",
                    async () => {
                        try {
                            await Updates.fetchUpdateAsync();
                            await Updates.reloadAsync();
                        } catch (e: any) {
                            showFeedback("Error", e.message, 'error');
                        }
                    },
                    { type: 'info', confirmText: 'Actualizar', cancelText: 'Después' }
                );
            } else {
                showFeedback("Todo al día", "Ya tienes la última versión.", 'success');
            }
        } catch (error: any) {
            showFeedback("Error", error.message, 'error');
        } finally {
            setChecking(false);
        }
    };

    return (
        <>
            <Stack
                screenOptions={{
                    headerStyle: { backgroundColor: isDark ? '#09090b' : '#fafafa' },
                    headerTintColor: isDark ? '#ffffff' : '#09090b',
                    headerTitleStyle: { fontWeight: 'bold' },
                    contentStyle: { backgroundColor: isDark ? '#09090b' : '#fafafa' }
                }}
            >
                <Stack.Screen
                    name="index"
                    options={{
                        title: 'Panel Limpieza',
                        headerRight: () => (
                            <TouchableOpacity
                                onPress={() => setProfileVisible(true)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 12,
                                    backgroundColor: isDark ? 'rgba(39,39,42,0.5)' : 'rgba(244,244,245,1)',
                                }}
                            >
                                <UserCircle size={20} color={isDark ? '#a1a1aa' : '#71717a'} />
                                <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#a1a1aa' : '#71717a' }}>
                                    {employeeName?.split(' ')[0] || 'Perfil'}
                                </Text>
                            </TouchableOpacity>
                        ),
                    }}
                />
            </Stack>

            {/* Modal de Perfil */}
            <Modal visible={profileVisible} transparent animationType="slide" onRequestClose={() => setProfileVisible(false)}>
                <Pressable
                    onPress={() => setProfileVisible(false)}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
                >
                    <Pressable onPress={() => {}} style={{
                        backgroundColor: isDark ? '#18181b' : '#ffffff',
                        borderTopLeftRadius: 28,
                        borderTopRightRadius: 28,
                        paddingBottom: 40,
                    }}>
                        {/* Handle bar */}
                        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? '#3f3f46' : '#d4d4d8' }} />
                        </View>

                        <ScrollView style={{ paddingHorizontal: 24 }}>
                            {/* Header */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                                    <View style={{
                                        width: 56, height: 56, borderRadius: 18,
                                        backgroundColor: isDark ? '#27272a' : '#f4f4f5',
                                        justifyContent: 'center', alignItems: 'center',
                                    }}>
                                        <UserCircle size={32} color={isDark ? '#e4e4e7' : '#18181b'} />
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#ffffff' : '#09090b' }}>
                                            {employeeName}
                                        </Text>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#71717a' : '#a1a1aa', marginTop: 2 }}>
                                            {userEmail}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setProfileVisible(false)} style={{
                                    width: 36, height: 36, borderRadius: 12,
                                    backgroundColor: isDark ? '#27272a' : '#f4f4f5',
                                    justifyContent: 'center', alignItems: 'center',
                                }}>
                                    <X size={18} color={isDark ? '#71717a' : '#a1a1aa'} />
                                </TouchableOpacity>
                            </View>

                            {/* Rol */}
                            <View style={{
                                flexDirection: 'row', alignItems: 'center', gap: 10,
                                padding: 16, borderRadius: 16, marginBottom: 12,
                                backgroundColor: isDark ? '#27272a' : '#f4f4f5',
                            }}>
                                <View style={{
                                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                                    backgroundColor: isDark ? '#09090b' : '#e4e4e7',
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, color: isDark ? '#a1a1aa' : '#52525b' }}>
                                        {role}
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#71717a' : '#a1a1aa' }}>
                                    Panel de Limpieza
                                </Text>
                            </View>

                            {/* Tema */}
                            <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: isDark ? '#52525b' : '#a1a1aa', marginBottom: 8, marginLeft: 4 }}>
                                Tema
                            </Text>
                            <View style={{
                                flexDirection: 'row', borderRadius: 16, padding: 4, marginBottom: 16,
                                backgroundColor: isDark ? '#09090b' : '#f4f4f5',
                                borderWidth: 1, borderColor: isDark ? '#27272a' : '#e4e4e7',
                            }}>
                                {[
                                    { mode: 'light' as const, icon: <Sun size={18} color={themeMode === 'light' ? '#fbbf24' : (isDark ? '#3f3f46' : '#d4d4d8')} /> },
                                    { mode: 'dark' as const, icon: <Moon size={18} color={themeMode === 'dark' ? '#818cf8' : (isDark ? '#3f3f46' : '#d4d4d8')} /> },
                                    { mode: 'system' as const, icon: <Smartphone size={18} color={themeMode === 'system' ? '#a1a1aa' : (isDark ? '#3f3f46' : '#d4d4d8')} /> },
                                ].map(item => (
                                    <TouchableOpacity
                                        key={item.mode}
                                        onPress={() => setThemeMode(item.mode)}
                                        style={{
                                            flex: 1, alignItems: 'center', justifyContent: 'center',
                                            paddingVertical: 12, borderRadius: 12,
                                            backgroundColor: themeMode === item.mode ? (isDark ? '#27272a' : '#ffffff') : 'transparent',
                                        }}
                                    >
                                        {item.icon}
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Actualizaciones */}
                            <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: isDark ? '#52525b' : '#a1a1aa', marginBottom: 8, marginLeft: 4 }}>
                                Sistema
                            </Text>
                            <View style={{
                                padding: 16, borderRadius: 16, marginBottom: 12,
                                backgroundColor: isDark ? '#27272a' : '#f4f4f5',
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <Wifi size={18} color={isDark ? '#34d399' : '#059669'} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#ffffff' : '#09090b' }}>Actualizaciones OTA</Text>
                                        <Text style={{ fontSize: 10, color: isDark ? '#52525b' : '#a1a1aa', marginTop: 2 }}>
                                            {Updates.updateId ? 'ID: ' + Updates.updateId.slice(0, 8) : 'Versión embebida'}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={handleCheckUpdate}
                                    disabled={checking}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                        paddingVertical: 12, borderRadius: 14,
                                        backgroundColor: isDark ? '#064e3b' : '#d1fae5',
                                        borderWidth: 1, borderColor: isDark ? '#047857' : '#6ee7b7',
                                        opacity: checking ? 0.7 : 1,
                                    }}
                                >
                                    {checking
                                        ? <ActivityIndicator size="small" color={isDark ? '#34d399' : '#059669'} />
                                        : <RefreshCw size={16} color={isDark ? '#34d399' : '#059669'} />
                                    }
                                    <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: isDark ? '#34d399' : '#059669' }}>
                                        {checking ? 'Buscando...' : 'Verificar Actualizaciones'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Cerrar sesión */}
                            <TouchableOpacity
                                onPress={handleLogout}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                    paddingVertical: 16, borderRadius: 16, marginTop: 8,
                                    backgroundColor: isDark ? '#450a0a' : '#fef2f2',
                                    borderWidth: 1, borderColor: isDark ? '#991b1b' : '#fecaca',
                                }}
                            >
                                <LogOut size={18} color="#ef4444" />
                                <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, color: '#ef4444' }}>
                                    Cerrar Sesión
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}
