import React, { memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { X, Car, Camera, Minus, Plus } from 'lucide-react-native';
import { MultiPaymentInput } from '../../MultiPaymentInput';
import { PlateScanner } from '../../ui/PlateScanner';
import { VehicleSearchResult } from '../../../lib/vehicle-catalog';
import { PaymentEntry } from '../../../lib/payment-types';
import { Room } from '../../../lib/types';
import { cn } from '../../../lib/utils';
import { ProcessingOverlay } from '../../ui/ProcessingOverlay';

export interface EntryModalProps {
    visible: boolean;
    onClose: () => void;
    room: any; // Ideally Room, but partials can be tricky. Let's try to constrain it more if possible, or keep as any if the shape is dynamic in usage. 
    // Actually, let's use Room | null since it can be null.
    // Update: The parent passes `selectedRoom` which is a mix of Room + Stay.
    // For now, let's keep it loose in the Prop definition to avoid breaking the build if the parent constructs it ad-hoc, 
    // BUT inside the component we strictly access properties known to exist.
    // Ideally: room: Room & { stay: RoomStay } | null
    isDark: boolean;
    plate: string;
    setPlate: (v: string) => void;
    brand: string;
    setBrand: (v: string) => void;
    model: string;
    setModel: (v: string) => void;
    personCount: number;
    setPersonCount: (v: React.SetStateAction<number>) => void;
    payments: PaymentEntry[];
    setPayments: (v: PaymentEntry[]) => void;
    actionLoading: boolean;
    onSubmit: () => void;
    vehicleSearch: string;
    handleVehicleSearch: (t: string) => void;
    showSearchResults: boolean;
    searchResults: VehicleSearchResult[];
    selectVehicle: (v: VehicleSearchResult) => void;
}

export const EntryModal = memo(({
    visible, onClose, room, isDark, plate, setPlate, brand, setBrand, model, setModel,
    personCount, setPersonCount, payments, setPayments, actionLoading, onSubmit,
    vehicleSearch, handleVehicleSearch, showSearchResults, searchResults, selectVehicle
}: EntryModalProps) => {
    const basePrice = room?.room_types?.base_price ?? 0;
    const extraPrice = room?.room_types?.extra_person_price ?? 0;
    const extraCount = Math.max(0, personCount - 2);
    const amount = basePrice + (extraCount * extraPrice);

    const [showScanner, setShowScanner] = React.useState(false);

    if (showScanner) {
        return (
            <Modal visible={visible} animationType="slide">
                <PlateScanner 
                    onClose={() => setShowScanner(false)} 
                    onPlateScanned={(scannedPlate: string) => {
                        setPlate(scannedPlate);
                        setShowScanner(false);
                    }}
                    onVehicleScanned={(result) => {
                        if (result.plate) setPlate(result.plate);
                        if (result.brand) setBrand(result.brand);
                        if (result.model) setModel(result.model);
                        setShowScanner(false);
                    }}
                />
            </Modal>
        );
    }

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <View className="flex-1 justify-end bg-black/70">
                    <View className="rounded-t-3xl max-h-[90%] bg-white dark:bg-zinc-950">
                        <View className="flex-row justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
                            <View>
                                <Text className="text-[10px] font-black uppercase tracking-widest mb-1 text-blue-500 dark:text-blue-400">Check-in Valet</Text>
                                <Text className="text-xl font-black text-zinc-900 dark:text-white">Hab. {room?.number}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
                                <X color={isDark ? '#71717a' : '#52525b'} size={20} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
                            <View className="mb-6">
                                <View className="flex-row items-center gap-2 mb-4">
                                    <Car color="#3b82f6" size={20} />
                                    <Text className="text-base font-semibold text-zinc-800 dark:text-white">Datos del Vehículo</Text>
                                </View>
                                <View className="mb-3">
                                    <View className="mb-4 relative">
                                        <View className={cn(
                                            "flex-row items-center border rounded-xl px-4",
                                            !plate.trim() ? "bg-red-50 border-red-100" : "bg-zinc-50 border-zinc-200",
                                            "dark:bg-zinc-700 dark:border-zinc-600"
                                        )}>
                                            <TextInput
                                                value={plate}
                                                onChangeText={setPlate}
                                                placeholder="Placa (Obligatorio) *"
                                                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                                                autoCapitalize="characters"
                                                className="flex-1 py-3 text-lg font-bold uppercase text-zinc-800 dark:text-white"
                                            />
                                            <TouchableOpacity onPress={() => setShowScanner(true)} className="p-2 ml-2 bg-blue-500 rounded-lg">
                                                <Camera color="#ffffff" size={24} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    
                                    <View className="mb-4 relative">
                                        <TextInput
                                            value={vehicleSearch}
                                            onChangeText={handleVehicleSearch}
                                            placeholder="Buscar en catálogo..."
                                            placeholderTextColor={isDark ? '#3f3f46' : '#a1a1aa'}
                                            className="border-2 rounded-2xl py-4 px-4 font-bold bg-zinc-50 border-zinc-100 text-zinc-900 dark:bg-black dark:border-zinc-800 dark:text-white"
                                        />
                                        {showSearchResults && searchResults.length > 0 && (
                                            <View className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border shadow-lg max-h-48 bg-white border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
                                                <ScrollView nestedScrollEnabled>
                                                    {searchResults.map((result, idx) => (
                                                        <TouchableOpacity key={idx} onPress={() => selectVehicle(result)} className="flex-row items-center px-4 py-3 border-b border-zinc-100 dark:border-zinc-700">
                                                            <Text className="text-blue-500 font-medium">{result.brand.label}</Text>
                                                            <Text className="ml-2 text-zinc-600 dark:text-zinc-300">{result.model}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>

                                    <View className="flex-row gap-2 mb-4">
                                        <View className="flex-1">
                                            <TextInput
                                                value={brand}
                                                onChangeText={setBrand}
                                                placeholder="Marca *"
                                                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                                                className={cn(
                                                    "border rounded-xl px-4 py-3 text-sm font-bold",
                                                    !brand.trim() ? "bg-red-50 border-red-100" : "bg-zinc-50 border-zinc-200",
                                                    "text-zinc-800 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                                )}
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <TextInput
                                                value={model}
                                                onChangeText={setModel}
                                                placeholder="Modelo *"
                                                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                                                className={cn(
                                                    "border rounded-xl px-4 py-3 text-sm font-bold",
                                                    !model.trim() ? "bg-red-50 border-red-100" : "bg-zinc-50 border-zinc-200",
                                                    "text-zinc-800 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                                )}
                                            />
                                        </View>
                                    </View>
                                </View>
                            </View>
                            <View className="border-t pt-8 mb-6 border-zinc-100 dark:border-zinc-800">
                                <View className="flex-row gap-4 mb-4">
                                    <View className="flex-1">
                                        <Text className="text-[10px] uppercase font-black tracking-widest mb-2 text-zinc-400 dark:text-zinc-500">Personas</Text>
                                        <View className="flex-row items-center gap-2">
                                            <TouchableOpacity onPress={() => setPersonCount((prev: number) => Math.max(1, prev - 1))} className="w-12 h-12 rounded-xl items-center justify-center border-2 bg-zinc-100 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                                                <Minus color={isDark ? '#a1a1aa' : '#52525b'} size={18} />
                                            </TouchableOpacity>
                                            <View className="flex-1 h-12 rounded-xl items-center justify-center bg-zinc-50 dark:bg-zinc-900">
                                                <Text className="text-xl font-black text-zinc-900 dark:text-white">{personCount}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => setPersonCount((prev: number) => prev + 1)} className="w-12 h-12 rounded-xl items-center justify-center border-2 bg-zinc-100 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                                                <Plus color={isDark ? '#a1a1aa' : '#52525b'} size={18} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <View className="flex-1 rounded-2xl p-4 border-2 bg-zinc-50 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                                        <Text className="text-[10px] font-black uppercase tracking-widest mb-1 text-zinc-400 dark:text-zinc-500">Total</Text>
                                        <Text className="text-3xl font-black text-emerald-500">${amount.toFixed(2)}</Text>
                                    </View>
                                </View>

                                {/* Desglose de conceptos */}
                                <View className="mb-6 rounded-xl border overflow-hidden border-zinc-100 dark:border-zinc-800">
                                    <View className="flex-row justify-between items-center px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50">
                                        <Text className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Estancia Habitación</Text>
                                        <Text className="text-sm font-black text-zinc-800 dark:text-white">${basePrice.toFixed(2)}</Text>
                                    </View>
                                    {Array.from({ length: extraCount }).map((_, i) => (
                                        <View key={`extra-${i}`} className="flex-row justify-between items-center px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
                                            <View className="flex-row items-center gap-2">
                                                <View className="w-5 h-5 rounded-full items-center justify-center bg-amber-100 dark:bg-amber-500/20">
                                                    <Text className="text-[10px] font-black text-amber-600 dark:text-amber-400">{i + 1}</Text>
                                                </View>
                                                <Text className="text-xs font-bold text-amber-600 dark:text-amber-400">Persona Extra</Text>
                                            </View>
                                            <Text className="text-sm font-black text-amber-600 dark:text-amber-400">+${extraPrice.toFixed(2)}</Text>
                                        </View>
                                    ))}
                                    <View className="flex-row justify-between items-center px-4 py-3 border-t-2 border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900">
                                        <Text className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total</Text>
                                        <Text className="text-base font-black text-emerald-600 dark:text-emerald-400">${amount.toFixed(2)}</Text>
                                    </View>
                                </View>

                                <MultiPaymentInput totalAmount={amount} payments={payments} onPaymentsChange={setPayments} disabled={actionLoading} />
                            </View>
                            <View className="flex-row gap-3 pb-12">
                                <TouchableOpacity onPress={onClose} disabled={actionLoading} className="flex-1 h-14 rounded-2xl items-center justify-center border-2 border-zinc-200 dark:border-zinc-800" style={{ opacity: actionLoading ? 0.5 : 1 }}>
                                    <Text className="font-black uppercase tracking-widest text-xs text-zinc-400 dark:text-zinc-500">Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={onSubmit}
                                    disabled={actionLoading || !plate.trim() || !brand.trim() || !model.trim()}
                                    className={`flex-1 h-14 rounded-2xl items-center justify-center flex-row ${(plate.trim() && brand.trim() && model.trim() && !actionLoading)
                                            ? 'bg-blue-600'
                                            : 'bg-zinc-200 dark:bg-zinc-800'
                                        }`}
                                    style={{ opacity: actionLoading ? 0.5 : 1 }}
                                >
                                    {actionLoading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text className={`font-black uppercase tracking-widest text-xs ${(plate.trim() && brand.trim() && model.trim())
                                                ? 'text-white'
                                                : 'text-zinc-400 dark:text-zinc-600'
                                            }`}>
                                            Registrar Entrada
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                            <ProcessingOverlay visible={actionLoading} message="Registrando entrada..." />
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
});
