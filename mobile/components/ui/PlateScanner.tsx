import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { X, Camera as CameraIcon, Zap } from 'lucide-react-native';
import { useTheme } from '../../contexts/theme-context';

interface PlateScannerProps {
    onClose: () => void;
    onPlateScanned: (plate: string) => void;
}

export function PlateScanner({ onClose, onPlateScanned }: PlateScannerProps) {
    const { isDark } = useTheme();
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState<CameraType>('back');
    const [isProcessing, setIsProcessing] = useState(false);
    const cameraRef = useRef<CameraView>(null);

    // TODO: Usar Edge Function OCR
    const processImageOCR = async (base64String: string) => {
        setIsProcessing(true);
        try {
            // Placeholder: Simulate API OCR call 
            // const { data, error } = await supabase.functions.invoke('ocr-plate', { body: { image: base64String } })
            await new Promise(res => setTimeout(res, 1500));
            // Simulate reading "LXR2024"
            onPlateScanned('LXR2024');
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const takePicture = async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
            if (photo && photo.base64) {
                await processImageOCR(photo.base64);
            }
        } catch (e) {
            console.error("Camera failed:", e);
        }
    };

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <View style={[styles.container, { backgroundColor: isDark ? '#09090b' : '#fafafa', justifyContent: 'center' }]}>
                <Text style={{ color: isDark ? '#fff' : '#000', textAlign: 'center', marginBottom: 20 }}>
                    Necesitamos permiso para usar la cámara y escanear la placa.
                </Text>
                <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
                    <Text style={styles.permissionText}>Otorgar Permiso</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView 
                ref={cameraRef} 
                style={styles.camera} 
                facing={facing}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"], // Optionally support barcodes simultaneously
                }}
            >
                <View style={styles.overlay}>
                    {/* Header bar */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                            <X color="#ffffff" size={28} />
                        </TouchableOpacity>
                        <View style={styles.titleContainer}>
                            <Text style={styles.headerTitle}>Ubica la placa en el recuadro</Text>
                        </View>
                        <View style={styles.iconButtonSpacer} />
                    </View>

                    {/* Target Box Indicator */}
                    <View style={styles.aimBoxContainer}>
                        <View style={styles.aimBox} />
                    </View>

                    {/* Footer Controls */}
                    <View style={styles.footer}>
                        {isProcessing ? (
                            <View style={styles.processingIndicator}>
                                <ActivityIndicator size="large" color="#ffffff" />
                                <Text style={styles.processingText}>Escaneando OCR...</Text>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={takePicture} style={styles.captureButton}>
                                <View style={styles.captureInnerCircle}>
                                    <CameraIcon color="#000" size={32} />
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)', // Slight tint to make aim box pop
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconButtonSpacer: {
        width: 44,
    },
    titleContainer: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    aimBoxContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    aimBox: {
        width: 300,
        height: 120, // Rectangular for plates
        borderWidth: 3,
        borderColor: '#eab308', // Luxor yellow
        borderRadius: 12,
        backgroundColor: 'transparent',
        shadowColor: '#eab308',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
    },
    footer: {
        height: 140,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 40,
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureInnerCircle: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    processingIndicator: {
        alignItems: 'center',
    },
    processingText: {
        color: '#fff',
        marginTop: 12,
        fontWeight: 'bold',
        fontSize: 16,
    },
    permissionButton: {
        backgroundColor: '#eab308',
        padding: 16,
        borderRadius: 12,
        marginHorizontal: 40,
        alignItems: 'center',
    },
    permissionText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
