import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Car, LogOut, CheckCircle2, AlertTriangle, ArrowRightLeft, Clock } from 'lucide-react-native';
import { SalesOrderItem } from '../../lib/types';

export interface CompactRoomCardProps {
    roomId: string;
    roomNumber: string;
    vehiclePlate: string | null;
    valetEmployeeId: string | null;
    isUrgent: boolean;
    isProposed: boolean;
    isCheckoutReviewed: boolean;
    hasActiveShift: boolean;
    employeeId: string | null;
    isDark: boolean;
    pendingExtras: SalesOrderItem[];
    pendingRoomChangeItem?: SalesOrderItem | null;
    onPress: () => void;
    size: number;
}

export const CompactRoomCard = memo(({
    roomId,
    roomNumber,
    vehiclePlate,
    valetEmployeeId,
    isUrgent,
    isProposed,
    isCheckoutReviewed,
    hasActiveShift,
    employeeId,
    isDark,
    pendingExtras,
    pendingRoomChangeItem,
    onPress,
    size
}: CompactRoomCardProps) => {
    const isPendingEntry = !vehiclePlate;
    const isPendingCheckout = !!vehiclePlate && !isCheckoutReviewed;

    const pendingAcceptanceExtras = pendingExtras?.filter(i => !i.delivery_status || i.delivery_status === 'PENDING_VALET') || [];
    const acceptedExtras = pendingExtras?.filter(i => i.delivery_status === 'ACCEPTED') || [];

    const showAcceptButton = pendingAcceptanceExtras.length > 0;
    const showVerifyButton = acceptedExtras.length > 0 && !showAcceptButton;
    const hasRoomChange = !!pendingRoomChangeItem;

    const isUnassignedEntry = isPendingEntry && !valetEmployeeId;
    const isMyPendingEntry = isPendingEntry && !!valetEmployeeId && valetEmployeeId === employeeId;
    const isOtherValetEntry = isPendingEntry && !!valetEmployeeId && valetEmployeeId !== employeeId;

    // Determine appearance based on priority
    let bg = isDark ? '#18181b' : '#f4f4f5'; // default stable
    let border = isDark ? '#27272a' : '#e4e4e7';
    let textColor = isDark ? '#a1a1aa' : '#52525b';
    let numberColor = isDark ? '#ffffff' : '#09090b';
    let Icon = CheckCircle2;
    let label = '';
    let isBlinking = false;

    if (isUrgent) {
        bg = isDark ? '#7f1d1d' : '#fef2f2';
        border = isDark ? '#ef4444' : '#fca5a5';
        textColor = isDark ? '#fca5a5' : '#ef4444';
        numberColor = isDark ? '#fef2f2' : '#991b1b';
        Icon = LogOut;
        label = 'URGENTE';
        isBlinking = true;
    } else if (showAcceptButton || showVerifyButton || hasRoomChange) {
        bg = isDark ? '#431407' : '#fff7ed';
        border = isDark ? '#ea580c' : '#fdba74';
        textColor = isDark ? '#fb923c' : '#ea580c';
        numberColor = isDark ? '#fff7ed' : '#9a3412';
        Icon = AlertTriangle;
        label = 'SERVICIO';
    } else if (isMyPendingEntry) {
        bg = isDark ? '#000000' : '#18181b';
        border = isDark ? '#3f3f46' : '#27272a';
        textColor = isDark ? '#d4d4d8' : '#e4e4e7';
        numberColor = '#ffffff';
        Icon = Car;
        label = 'MI ENTRADA';
    } else if (isUnassignedEntry) {
        bg = isDark ? '#1e1b4b' : '#eef2ff';
        border = isDark ? '#4338ca' : '#a5b4fc';
        textColor = isDark ? '#818cf8' : '#4f46e5';
        numberColor = isDark ? '#e0e7ff' : '#312e81';
        Icon = Car;
        label = 'ENTRADA';
    } else if (isOtherValetEntry) {
        bg = isDark ? '#27272a' : '#f4f4f5';
        border = isDark ? '#3f3f46' : '#e4e4e7';
        textColor = isDark ? '#71717a' : '#a1a1aa';
        numberColor = isDark ? '#a1a1aa' : '#71717a';
        Icon = Car;
        label = 'ASIGNADA';
    } else if (isProposed) {
        bg = isDark ? '#451a03' : '#fefce8';
        border = isDark ? '#ca8a04' : '#fde047';
        textColor = isDark ? '#facc15' : '#ca8a04';
        numberColor = isDark ? '#fefce8' : '#854d0e';
        Icon = Clock;
        label = 'SALIDA';
    } else if (isPendingCheckout) {
        bg = isDark ? '#064e3b' : '#ecfdf5';
        border = isDark ? '#059669' : '#6ee7b7';
        textColor = isDark ? '#34d399' : '#059669';
        numberColor = isDark ? '#ecfdf5' : '#064e3b';
        Icon = CheckCircle2;
        label = 'ESTABLE';
    } else {
        // Checking out but reviewed / waiting
        bg = isDark ? '#18181b' : '#f4f4f5';
        border = isDark ? '#27272a' : '#e4e4e7';
        textColor = isDark ? '#71717a' : '#a1a1aa';
        numberColor = isDark ? '#a1a1aa' : '#52525b';
        Icon = CheckCircle2;
        label = 'LISTA';
    }

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={{
                width: size,
                height: size,
                backgroundColor: bg,
                borderColor: border,
                borderWidth: 2,
                borderRadius: 16,
                padding: 10,
                justifyContent: 'space-between',
                opacity: hasActiveShift ? 1 : 0.6,
            }}
        >
            <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text
                    style={{
                        fontSize: size > 100 ? 32 : 24,
                        fontWeight: '900',
                        color: numberColor,
                        letterSpacing: -1,
                        textAlign: 'center'
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                >
                    {roomNumber}
                </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Icon size={12} color={textColor} />
                <Text
                    style={{
                        fontSize: 9,
                        fontWeight: '800',
                        color: textColor,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                >
                    {label}
                </Text>
            </View>
            
            {/* Pequeño indicador si hay placa en estado estable */}
            {vehiclePlate && !isPendingEntry && label === 'ESTABLE' && (
               <View style={{position: 'absolute', top: 6, right: 6}}>
                   <Car size={10} color={border} />
               </View>
            )}
            
            {/* Indicador de multiples servicios */}
            {(showAcceptButton || showVerifyButton) && (pendingAcceptanceExtras.length + acceptedExtras.length > 1) && (
                <View style={{position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center'}}>
                    <Text style={{color: 'white', fontSize: 10, fontWeight: '900'}}>{pendingAcceptanceExtras.length + acceptedExtras.length}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
});
