import React from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Car, CheckCircle2, LogOut, AlertTriangle, ArrowRightLeft, X } from 'lucide-react-native';
import { SalesOrderItem } from '../../../lib/types';
import * as Haptics from 'expo-haptics';
import { ProcessingOverlay } from '../../ui/ProcessingOverlay';

export interface ValetActionModalProps {
    visible: boolean;
    onClose: () => void;
    
    // Original RoomCardProps data
    roomId: string;
    stayId: string;
    roomNumber: string;
    vehiclePlate: string | null;
    vehicleBrand: string | null;
    valetEmployeeId: string | null;
    isUrgent: boolean;
    isProposed: boolean;
    isDark: boolean;
    hasActiveShift: boolean;
    actionLoading: boolean;
    employeeId: string | null;
    
    // Actions
    handleAcceptEntry: (stayId: string, roomNumber: string, valetId: string) => Promise<boolean>;
    handleOpenEntry: (roomId: string) => void;
    handleOpenCheckout: (roomId: string) => void;
    handleProposeCheckout: (stayId: string, roomNumber: string, valetId: string) => Promise<boolean>;
    
    // Services
    pendingExtras: SalesOrderItem[];
    onVerifyExtras: (roomId: string, items: SalesOrderItem[]) => void;
    onAcceptVerification: (roomId: string, items: SalesOrderItem[]) => Promise<void>;
    isCheckoutReviewed: boolean;
    
    // Room change
    pendingRoomChangeItem?: SalesOrderItem | null;
    onVerifyRoomChange?: (roomId: string, item: SalesOrderItem) => void;
}

export const ValetActionModal = ({
    visible,
    onClose,
    roomId,
    stayId,
    roomNumber,
    vehiclePlate,
    vehicleBrand,
    valetEmployeeId,
    isUrgent,
    isProposed,
    isDark,
    hasActiveShift,
    actionLoading,
    employeeId,
    handleAcceptEntry,
    handleOpenEntry,
    handleOpenCheckout,
    handleProposeCheckout,
    pendingExtras,
    onVerifyExtras,
    onAcceptVerification,
    isCheckoutReviewed,
    pendingRoomChangeItem,
    onVerifyRoomChange
}: ValetActionModalProps) => {
    
    const isPendingEntry = !vehiclePlate;
    const isPendingCheckout = !!vehiclePlate && !isCheckoutReviewed;

    const pendingAcceptanceExtras = pendingExtras?.filter(i => !i.delivery_status || i.delivery_status === 'PENDING_VALET') || [];
    const acceptedExtras = pendingExtras?.filter(i => i.delivery_status === 'ACCEPTED') || [];

    const showAcceptButton = pendingAcceptanceExtras.length > 0;
    const showVerifyButton = acceptedExtras.length > 0 && !showAcceptButton;

    const isUnassignedEntry = isPendingEntry && !valetEmployeeId;
    const isMyPendingEntry = isPendingEntry && !!valetEmployeeId;
    const isOtherValetEntry = isPendingEntry && !!valetEmployeeId && valetEmployeeId !== employeeId;

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable 
                onPress={onClose}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
            >
                <Pressable 
                    onPress={() => {}} // Prevenir que el toque cierre el modal
                    style={{
                        backgroundColor: isDark ? '#18181b' : '#ffffff',
                        borderTopLeftRadius: 28,
                        borderTopRightRadius: 28,
                        paddingBottom: 40,
                    }}
                >
                    {/* Handle bar */}
                    <View className="items-center pt-3 pb-2">
                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? '#3f3f46' : '#d4d4d8' }} />
                    </View>

                    {/* Header */}
                    <View className="px-6 pt-3 pb-5 flex-row justify-between items-center border-b border-zinc-100 dark:border-zinc-800">
                        <View>
                            <Text className="text-[10px] uppercase font-black tracking-widest text-zinc-400 dark:text-zinc-500">
                                Acciones Valet
                            </Text>
                            <Text className="text-3xl font-black text-zinc-900 dark:text-white mt-1">
                                Hab. {roomNumber}
                            </Text>
                            {vehiclePlate ? (
                                <View className="flex-row items-center mt-2 bg-zinc-100 dark:bg-zinc-800/50 self-start px-2 py-1 rounded-lg">
                                    <Car size={14} color={isDark ? '#a1a1aa' : '#52525b'} />
                                    <Text className="ml-2 font-black text-sm text-zinc-600 dark:text-zinc-300">
                                        {vehiclePlate} • {vehicleBrand}
                                    </Text>
                                </View>
                            ) : (
                                <Text className="mt-1 font-bold text-sm text-zinc-400">Sin auto registrado</Text>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 12,
                                backgroundColor: isDark ? '#27272a' : '#f4f4f5',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <X size={18} color={isDark ? '#71717a' : '#a1a1aa'} />
                        </TouchableOpacity>
                    </View>

                    {/* Processing overlay */}
                    <ProcessingOverlay visible={actionLoading} message="Procesando..." />

                    {/* Botones de acción */}
                    <View className="px-6 pt-5 gap-3" style={{ opacity: actionLoading ? 0.5 : 1 }}>
                        {isUrgent && (
                            <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 rounded-xl mb-2 flex-row items-center">
                                <AlertTriangle color="#ef4444" size={24} />
                                <View className="ml-3 flex-1">
                                    <Text className="text-red-600 dark:text-red-400 font-bold text-sm">¡El huésped pidió su auto!</Text>
                                    <Text className="text-red-500/80 dark:text-red-400/80 font-medium text-xs mt-0.5">Entrega el vehículo lo antes posible.</Text>
                                </View>
                            </View>
                        )}
                        
                        {isProposed && !isUrgent && (
                            <View className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-4 rounded-xl mb-2 flex-row items-center">
                                <AlertTriangle color="#f59e0b" size={24} />
                                <View className="ml-3 flex-1">
                                    <Text className="text-amber-600 dark:text-amber-400 font-bold text-sm">Revisión Solicitada</Text>
                                    <Text className="text-amber-500/80 dark:text-amber-400/80 font-medium text-xs mt-0.5">Recepción está esperando que revises la habitación.</Text>
                                </View>
                            </View>
                        )}

                        {/* Servicios Extras */}
                        {showAcceptButton && (
                            <TouchableOpacity
                                onPress={() => { onAcceptVerification(roomId, pendingAcceptanceExtras); onClose(); }}
                                disabled={!hasActiveShift || actionLoading}
                                className="flex-row items-center justify-center p-4 rounded-xl shadow-sm bg-indigo-500 dark:bg-indigo-600"
                            >
                                <CheckCircle2 color="white" size={20} strokeWidth={3} />
                                <Text className="font-black uppercase tracking-widest text-xs ml-2 text-white">
                                    Atender Servicio(s) ({pendingAcceptanceExtras.length})
                                </Text>
                            </TouchableOpacity>
                        )}

                        {showVerifyButton && (
                            <TouchableOpacity
                                onPress={() => { onVerifyExtras(roomId, acceptedExtras); onClose(); }}
                                disabled={!hasActiveShift || actionLoading}
                                className="flex-row items-center justify-center p-4 rounded-xl shadow-sm bg-amber-500 dark:bg-amber-600"
                            >
                                <AlertTriangle color="white" size={20} strokeWidth={3} />
                                <Text className="font-black uppercase tracking-widest text-xs ml-2 text-white">
                                    Completar Servicio(s) ({acceptedExtras.length})
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* Cambios de Habitación */}
                        {pendingRoomChangeItem && onVerifyRoomChange && (
                            <TouchableOpacity
                                onPress={() => { onVerifyRoomChange(roomId, pendingRoomChangeItem); onClose(); }}
                                disabled={!hasActiveShift || actionLoading}
                                className="flex-row items-center justify-center p-4 rounded-xl shadow-sm bg-blue-500 dark:bg-blue-600"
                            >
                                <ArrowRightLeft color="white" size={20} strokeWidth={3} />
                                <Text className="font-black uppercase tracking-widest text-xs ml-2 text-white">
                                    Verificar Cambio
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* Entrada/Salida Core */}
                        {isUnassignedEntry ? (
                            <TouchableOpacity
                                onPress={() => { handleAcceptEntry(stayId, roomNumber, employeeId!); onClose(); }}
                                disabled={!hasActiveShift || actionLoading}
                                className={`flex-row items-center justify-center p-4 rounded-xl shadow-sm ${hasActiveShift
                                    ? 'bg-zinc-900 dark:bg-white'
                                    : 'bg-zinc-200'
                                    }`}
                            >
                                <CheckCircle2 color={isDark ? '#000' : '#fff'} size={20} strokeWidth={3} />
                                <Text className="font-black uppercase tracking-widest text-xs ml-2 text-white dark:text-black">
                                    Aceptar Entrada
                                </Text>
                            </TouchableOpacity>
                        ) : isMyPendingEntry ? (
                            <TouchableOpacity
                                onPress={() => { handleOpenEntry(roomId); onClose(); }}
                                disabled={!hasActiveShift || actionLoading}
                                className={`flex-row items-center justify-center p-4 rounded-xl shadow-sm ${hasActiveShift
                                    ? 'bg-zinc-900 dark:bg-white'
                                    : 'bg-zinc-200'
                                    }`}
                            >
                                <Car color={isDark ? '#000' : '#fff'} size={20} strokeWidth={3} />
                                <Text className="font-black uppercase tracking-widest text-xs ml-2 text-white dark:text-black">
                                    Registrar Auto
                                </Text>
                            </TouchableOpacity>
                        ) : isPendingCheckout ? (
                            <>
                                {isUrgent ? (
                                    <TouchableOpacity
                                        onPress={() => { handleOpenCheckout(roomId); onClose(); }}
                                        disabled={!hasActiveShift || actionLoading}
                                        className={`flex-row items-center justify-center p-4 rounded-xl shadow-md ${hasActiveShift ? 'bg-red-600' : 'bg-zinc-200'
                                            }`}
                                    >
                                        <LogOut color="white" size={20} strokeWidth={3} />
                                        <Text className="text-white font-black uppercase tracking-widest ml-2">Entregar Auto</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <>
                                        {!isProposed && (
                                            <TouchableOpacity
                                                onPress={() => { handleProposeCheckout(stayId, roomNumber, employeeId!); onClose(); }}
                                                disabled={!hasActiveShift || actionLoading}
                                                className="flex-row items-center justify-center p-4 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700"
                                            >
                                                <Text className="font-black uppercase tracking-widest text-xs text-zinc-500 dark:text-zinc-400">
                                                    Avisar Salida
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            onPress={() => { handleOpenCheckout(roomId); onClose(); }}
                                            disabled={!hasActiveShift || actionLoading}
                                            className={`flex-row items-center justify-center p-4 rounded-xl border-2 ${hasActiveShift
                                                ? 'border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800'
                                                : 'bg-zinc-200 border-zinc-200'
                                                }`}
                                        >
                                            <LogOut color={isDark ? '#a1a1aa' : '#52525b'} size={20} strokeWidth={3} />
                                            <Text className="font-black uppercase tracking-widest text-xs ml-2 text-zinc-600 dark:text-zinc-300">
                                                Entregar
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </>
                        ) : (
                            <View className="flex-row items-center justify-center p-4 rounded-xl border-2 border-dashed bg-zinc-50 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                                <Text className="font-black uppercase tracking-widest text-xs text-zinc-400 dark:text-zinc-600">
                                    Revisión Enviada
                                </Text>
                            </View>
                        )}
                        
                        {isOtherValetEntry && (
                            <View className="mt-2 flex-row items-center justify-center p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800">
                                <Text className="font-bold text-xs text-zinc-500 dark:text-zinc-400">
                                    Esta entrada la está atendiendo otro valet
                                </Text>
                            </View>
                        )}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
