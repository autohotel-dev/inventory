import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { HelpCircle, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../contexts/theme-context';

export type ConfirmType = 'info' | 'warning' | 'danger';

interface ConfirmModalProps {
    visible: boolean;
    title: string;
    message: string;
    type?: ConfirmType;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({ 
    visible, 
    title, 
    message, 
    type = 'info', 
    confirmText = 'Confirmar', 
    cancelText = 'Cancelar', 
    onConfirm, 
    onCancel 
}: ConfirmModalProps) {
    const { isDark } = useTheme();

    const getIcon = () => {
        switch (type) {
            case 'danger':
                return <AlertTriangle size={48} color="#ef4444" strokeWidth={2.5} />;
            case 'warning':
                return <AlertTriangle size={48} color="#f59e0b" strokeWidth={2.5} />;
            default:
                return <HelpCircle size={48} color={isDark ? '#3b82f6' : '#2563eb'} strokeWidth={2.5} />;
        }
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
        >
            <View className="flex-1 justify-center items-center bg-black/80 px-6">
                <View
                    style={{ elevation: 10 }}
                    className={`w-full max-w-sm rounded-[40px] p-8 items-center border-2 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'
                        }`}
                >
                    <View className={`w-24 h-24 rounded-[32px] items-center justify-center mb-8 shadow-2xl ${isDark ? 'bg-zinc-950/50' : 'bg-zinc-50'
                        }`}>
                        <View className={`w-16 h-16 rounded-3xl items-center justify-center ${type === 'danger' ? (isDark ? 'bg-red-500/10' : 'bg-red-50') :
                                    type === 'warning' ? (isDark ? 'bg-amber-500/10' : 'bg-amber-50') :
                                        (isDark ? 'bg-blue-500/10' : 'bg-blue-50')
                            }`}>
                            {getIcon()}
                        </View>
                    </View>

                    <Text className={`text-2xl font-black text-center mb-3 tracking-tighter ${isDark ? 'text-white' : 'text-zinc-900'
                        }`}>
                        {title}
                    </Text>

                    <View className="px-2">
                        <Text className={`text-sm text-center mb-10 leading-5 font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'
                            }`}>
                            {message}
                        </Text>
                    </View>

                    <View className="flex-row gap-3 w-full">
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={onCancel}
                            className={`flex-1 h-14 rounded-2xl items-center justify-center border-2 ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-zinc-200'
                                }`}
                        >
                            <Text className={`font-black uppercase tracking-widest text-[10px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'
                                }`}>
                                {cancelText}
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={onConfirm}
                            className={`flex-1 h-14 rounded-2xl items-center justify-center shadow-lg border-2 ${
                                type === 'danger' ? 'bg-red-500 border-red-500' : 
                                (isDark ? 'bg-white border-zinc-100' : 'bg-zinc-900 border-zinc-900')
                            }`}
                        >
                            <Text className={`font-black uppercase tracking-widest text-[10px] ${
                                type === 'danger' ? 'text-white' : 
                                (isDark ? 'text-zinc-950' : 'text-white')
                                }`}>
                                {confirmText}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
