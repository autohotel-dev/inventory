import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, Vibration, Platform, Modal, StatusBar } from 'react-native';
import { Bell, X, Car, ShoppingCart, UserPlus, Clock, AlertTriangle, RefreshCcw, Megaphone, CheckCircle2 } from 'lucide-react-native';
import { notificationEventEmitter } from '../hooks/use-notifications';
import { useTheme } from './theme-context';

// Tipos de notificación soportados
export type InAppNotificationType =
    | 'VEHICLE_REQUEST'
    | 'NEW_CONSUMPTION'
    | 'NEW_ENTRY'
    | 'CHECKOUT_REQUEST'
    | 'NEW_EXTRA'
    | 'ROOM_CHANGE'
    | 'DAMAGE_REPORT'
    | 'PROMO_4H'
    | 'STAFF_BROADCAST'
    | 'GENERAL';

export interface InAppNotification {
    id: string;
    type: InAppNotificationType;
    title: string;
    message: string;
    data?: any;
    timestamp: number;
}

interface InAppNotificationContextType {
    showNotification: (notification: Omit<InAppNotification, 'id' | 'timestamp'>) => void;
    dismissNotification: (id: string) => void;
    dismissAll: () => void;
}

const InAppNotificationContext = createContext<InAppNotificationContextType | undefined>(undefined);

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Configuración de iconos y colores por tipo de notificación (light mode / dark mode)
const getNotificationConfig = (isDark: boolean): Record<InAppNotificationType, { icon: any; color: string; bgColor: string; textColor: string; subtitleColor: string }> => ({
    VEHICLE_REQUEST: { icon: Car, color: '#ef4444', bgColor: isDark ? '#1c1917' : '#fef2f2', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    CHECKOUT_REQUEST: { icon: Car, color: '#f97316', bgColor: isDark ? '#1c1917' : '#fff7ed', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    NEW_CONSUMPTION: { icon: ShoppingCart, color: '#3b82f6', bgColor: isDark ? '#1c1917' : '#eff6ff', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    NEW_ENTRY: { icon: UserPlus, color: '#22c55e', bgColor: isDark ? '#1c1917' : '#f0fdf4', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    NEW_EXTRA: { icon: UserPlus, color: '#8b5cf6', bgColor: isDark ? '#1c1917' : '#f5f3ff', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    ROOM_CHANGE: { icon: RefreshCcw, color: '#06b6d4', bgColor: isDark ? '#1c1917' : '#ecfeff', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    DAMAGE_REPORT: { icon: AlertTriangle, color: '#ef4444', bgColor: isDark ? '#1c1917' : '#fef2f2', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    PROMO_4H: { icon: Clock, color: '#eab308', bgColor: isDark ? '#1c1917' : '#fefce8', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    STAFF_BROADCAST: { icon: Megaphone, color: '#8b5cf6', bgColor: isDark ? '#1c1917' : '#f5f3ff', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    GENERAL: { icon: Bell, color: '#6b7280', bgColor: isDark ? '#1c1917' : '#f9fafb', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
});

// Colores por tipo de comunicado staff
const STAFF_BROADCAST_COLORS: Record<string, { gradient: string[]; accent: string; emoji: string; label: string }> = {
    comunicado: { gradient: ['#3b82f6', '#2563eb'], accent: '#60a5fa', emoji: '📢', label: 'Comunicado' },
    warning: { gradient: ['#f59e0b', '#d97706'], accent: '#fbbf24', emoji: '⚠️', label: 'Llamada de Atención' },
    urgent: { gradient: ['#ef4444', '#dc2626'], accent: '#f87171', emoji: '🚨', label: 'URGENTE' },
    instruction: { gradient: ['#06b6d4', '#0891b2'], accent: '#22d3ee', emoji: '📋', label: 'Instrucción' },
    recognition: { gradient: ['#22c55e', '#16a34a'], accent: '#4ade80', emoji: '🎉', label: 'Reconocimiento' },
};

// Modal de comunicado staff — solo se cierra con OK
function StaffBroadcastModal({
    notification,
    visible,
    onClose,
    isDark,
}: {
    notification: InAppNotification | null;
    visible: boolean;
    onClose: () => void;
    isDark: boolean;
}) {
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            ]).start();
            // Pulso en el icono
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else {
            scaleAnim.setValue(0.8);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    if (!notification) return null;

    const subType = notification.data?.notificationType || 'comunicado';
    const colors = STAFF_BROADCAST_COLORS[subType] || STAFF_BROADCAST_COLORS.comunicado;
    const senderName = notification.data?.senderName || 'Administración';
    // Strip emoji prefix from title for cleaner display
    const cleanTitle = notification.title?.replace(/^[\p{Emoji}\s]+/u, '').trim() || notification.title;

    return (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.85)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 24,
            }}>
                <Animated.View style={{
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                    width: '100%',
                    maxWidth: 380,
                    borderRadius: 28,
                    overflow: 'hidden',
                    backgroundColor: isDark ? '#18181b' : '#ffffff',
                    shadowColor: colors.gradient[0],
                    shadowOffset: { width: 0, height: 16 },
                    shadowOpacity: 0.4,
                    shadowRadius: 32,
                    elevation: 24,
                }}>
                    {/* Colored Header */}
                    <View style={{
                        backgroundColor: colors.gradient[0],
                        paddingTop: 32,
                        paddingBottom: 40,
                        alignItems: 'center',
                    }}>
                        {/* Badge */}
                        <View style={{
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            paddingHorizontal: 14,
                            paddingVertical: 4,
                            borderRadius: 20,
                            marginBottom: 16,
                        }}>
                            <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
                                {colors.label.toUpperCase()}
                            </Text>
                        </View>
                        {/* Animated Icon */}
                        <Animated.View style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transform: [{ scale: pulseAnim }],
                        }}>
                            <View style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                backgroundColor: 'rgba(255,255,255,0.3)',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <Megaphone color="#ffffff" size={28} strokeWidth={2.5} />
                            </View>
                        </Animated.View>
                    </View>

                    {/* Content */}
                    <View style={{ padding: 24, paddingTop: 20, alignItems: 'center' }}>
                        <Text style={{
                            fontSize: 20,
                            fontWeight: '800',
                            color: isDark ? '#fafafa' : '#09090b',
                            textAlign: 'center',
                            marginBottom: 12,
                            lineHeight: 26,
                        }}>
                            {cleanTitle}
                        </Text>
                        <Text style={{
                            fontSize: 15,
                            color: isDark ? '#a1a1aa' : '#52525b',
                            textAlign: 'center',
                            lineHeight: 22,
                            marginBottom: 20,
                        }}>
                            {notification.message}
                        </Text>

                        {/* Sender info */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 24,
                            opacity: 0.5,
                        }}>
                            <Text style={{
                                fontSize: 12,
                                color: isDark ? '#71717a' : '#a1a1aa',
                            }}>
                                Enviado por: {senderName}
                            </Text>
                        </View>

                        {/* OK Button */}
                        <TouchableOpacity
                            onPress={onClose}
                            activeOpacity={0.8}
                            style={{
                                width: '100%',
                                backgroundColor: colors.gradient[0],
                                paddingVertical: 16,
                                borderRadius: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                shadowColor: colors.gradient[0],
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 6,
                            }}
                        >
                            <CheckCircle2 color="#ffffff" size={20} strokeWidth={2.5} />
                            <Text style={{
                                color: '#ffffff',
                                fontSize: 16,
                                fontWeight: '700',
                                letterSpacing: 0.5,
                            }}>
                                Enterado
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

// Componente individual de notificación
function NotificationToast({
    notification,
    onDismiss,
    onOpenModal,
    index,
    isDark
}: {
    notification: InAppNotification;
    onDismiss: () => void;
    onOpenModal?: (notification: InAppNotification) => void;
    index: number;
    isDark: boolean;
}) {
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const notificationConfig = getNotificationConfig(isDark);
    const config = notificationConfig[notification.type] || notificationConfig.GENERAL;
    const Icon = config.icon;

    useEffect(() => {
        // Animación de entrada
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                tension: 100,
                friction: 10,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto-dismiss después de 6 segundos
        const autoDismissTimer = setTimeout(() => {
            handleDismiss();
        }, 6000);

        return () => clearTimeout(autoDismissTimer);
    }, []);

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss();
        });
    };

    // Animación de pulso para el icono
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    return (
        <Animated.View
            style={{
                position: 'absolute',
                top: 60 + (index * 110),
                left: 12,
                right: 12,
                transform: [{ translateY }],
                opacity,
                zIndex: 9999 - index,
            }}
        >
            <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => {
                    if (notification.type === 'STAFF_BROADCAST' && onOpenModal) {
                        onOpenModal(notification);
                    }
                    handleDismiss();
                }}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 20,
                    paddingLeft: 16,
                    borderRadius: 24,
                    backgroundColor: config.bgColor,
                    borderWidth: 1,
                    borderColor: config.color + '25',
                    // Sombra elegante
                    shadowColor: config.color,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 16,
                    elevation: 12,
                }}
            >
                {/* Indicador lateral de color */}
                <View
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 16,
                        bottom: 16,
                        width: 4,
                        borderRadius: 4,
                        backgroundColor: config.color,
                    }}
                />

                {/* Icono animado */}
                <Animated.View
                    style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        backgroundColor: config.color + '15',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16,
                        transform: [{ scale: pulseAnim }],
                    }}
                >
                    <View
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: config.color,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Icon color="#ffffff" size={22} strokeWidth={2.5} />
                    </View>
                </Animated.View>

                {/* Contenido */}
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                        style={{
                            fontSize: 15,
                            fontWeight: '700',
                            color: config.textColor,
                            marginBottom: 4,
                            letterSpacing: 0.2,
                        }}
                        numberOfLines={1}
                    >
                        {notification.title}
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: config.subtitleColor,
                            lineHeight: 18,
                        }}
                        numberOfLines={2}
                    >
                        {notification.message}
                    </Text>
                    {/* Timestamp */}
                    <Text
                        style={{
                            fontSize: 10,
                            color: config.subtitleColor,
                            opacity: 0.6,
                            marginTop: 6,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                        }}
                    >
                        Ahora · Toca para cerrar
                    </Text>
                </View>

                {/* Indicador visual de cerrar */}
                <View
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: isDark ? '#ffffff10' : '#00000008',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <X color={config.subtitleColor} size={14} strokeWidth={2.5} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

export function InAppNotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<InAppNotification[]>([]);
    const [broadcastModal, setBroadcastModal] = useState<InAppNotification | null>(null);
    const { isDark } = useTheme();

    const openBroadcastModal = useCallback((notification: InAppNotification) => {
        setBroadcastModal(notification);
    }, []);

    const closeBroadcastModal = useCallback(() => {
        setBroadcastModal(null);
    }, []);

    const playNotificationAlert = async () => {
        try {
            // Vibrar para alertar al usuario
            if (Platform.OS === 'android') {
                Vibration.vibrate([0, 200, 100, 200]);
            } else {
                Vibration.vibrate();
            }
            // NO crear notificación local para sonido — la push de la Edge Function
            // ya reproduce sonido. Crear una notificación local aquí causaba duplicados.
        } catch (error) {
            console.log('[InAppNotification] Error en vibración:', error);
        }
    };

    const showNotification = useCallback((notification: Omit<InAppNotification, 'id' | 'timestamp'>) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newNotification: InAppNotification = {
            ...notification,
            id,
            timestamp: Date.now(),
        };

        console.log('[InAppNotification] Mostrando notificación:', newNotification.title);

        // Vibrar para alertar
        playNotificationAlert();

        // Si es STAFF_BROADCAST, abrir modal automáticamente
        if (notification.type === 'STAFF_BROADCAST') {
            setBroadcastModal(newNotification);
        }

        setNotifications(prev => {
            // Limitar a máximo 3 notificaciones visibles
            const updated = [newNotification, ...prev].slice(0, 3);
            return updated;
        });
    }, []);

    const dismissNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const dismissAll = useCallback(() => {
        setNotifications([]);
    }, []);

    // Escuchar eventos del hook de notificaciones
    useEffect(() => {
        const handleInAppNotification = (data: any) => {
            console.log('[InAppNotification] Evento recibido:', data);
            showNotification({
                type: data.type || 'GENERAL',
                title: data.title,
                message: data.message,
                data: data.data,
            });
        };

        notificationEventEmitter.on('inAppNotification', handleInAppNotification);

        return () => {
            notificationEventEmitter.off('inAppNotification', handleInAppNotification);
        };
    }, [showNotification]);

    return (
        <InAppNotificationContext.Provider value={{ showNotification, dismissNotification, dismissAll }}>
            {children}
            {/* Renderizar notificaciones */}
            <View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    pointerEvents: 'box-none',
                }}
            >
                {notifications.map((notification, index) => (
                    <NotificationToast
                        key={notification.id}
                        notification={notification}
                        index={index}
                        isDark={isDark}
                        onDismiss={() => dismissNotification(notification.id)}
                        onOpenModal={openBroadcastModal}
                    />
                ))}
            </View>
            {/* Modal de comunicado staff */}
            <StaffBroadcastModal
                notification={broadcastModal}
                visible={!!broadcastModal}
                onClose={closeBroadcastModal}
                isDark={isDark}
            />
        </InAppNotificationContext.Provider>
    );
}

export function useInAppNotification() {
    const context = useContext(InAppNotificationContext);
    if (context === undefined) {
        throw new Error('useInAppNotification must be used within an InAppNotificationProvider');
    }
    return context;
}
