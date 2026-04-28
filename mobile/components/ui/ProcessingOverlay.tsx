import React from 'react';
import { View, Text, ActivityIndicator, Modal } from 'react-native';

interface ProcessingOverlayProps {
    visible: boolean;
    message?: string;
}

/**
 * Full-screen semi-transparent overlay with spinner.
 * Blocks all touch interactions while a process is running.
 */
export function ProcessingOverlay({ visible, message = 'Procesando...' }: ProcessingOverlayProps) {
    if (!visible) return null;

    return (
        <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.6)',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <View style={{
                    backgroundColor: '#18181b',
                    borderRadius: 16,
                    paddingVertical: 24,
                    paddingHorizontal: 32,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#27272a',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.4,
                    shadowRadius: 16,
                    elevation: 20,
                }}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={{
                        color: '#d4d4d8',
                        marginTop: 12,
                        fontSize: 14,
                        fontWeight: '600',
                    }}>
                        {message}
                    </Text>
                </View>
            </View>
        </Modal>
    );
}
