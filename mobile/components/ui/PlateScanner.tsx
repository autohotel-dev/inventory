import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { X, Camera as CameraIcon, RotateCcw } from 'lucide-react-native';
import { useTheme } from '../../contexts/theme-context';
import { useConfirm } from '../../contexts/confirm-context';

export interface VehicleScanResult {
    plate: string | null;
    brand: string | null;
    model: string | null;
}

interface PlateScannerProps {
    onClose: () => void;
    onPlateScanned: (plate: string) => void;
    onVehicleScanned?: (result: VehicleScanResult) => void;
}

export function PlateScanner({ onClose, onPlateScanned, onVehicleScanned }: PlateScannerProps) {
    const { isDark } = useTheme();
    const { showConfirm } = useConfirm();
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState<CameraType>('back');
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [zoomIndex, setZoomIndex] = useState(0);
    const zoomLevels = [0, 0.03, 0.08];
    const zoomLabels = ['1x', '2x', '3x'];
    const cameraRef = useRef<CameraView>(null);

    const toggleZoom = () => {
        setZoomIndex((prev) => (prev + 1) % zoomLevels.length);
    };

    const processImageOCR = async (base64String: string) => {
        setIsProcessing(true);
        setStatusText('Analizando vehículo...');
        try {
            // Usar fetch directo para mejor control de errores
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
            
            const response = await fetch(`${supabaseUrl}/functions/v1/ocr-plate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({ image: base64String }),
            });

            const data = await response.json();
            console.log('[OCR] Response status:', response.status, 'Data:', JSON.stringify(data).substring(0, 200));

            if (!response.ok) {
                console.error('[OCR] Function error:', data);
                setStatusText('Error en el servicio');
                showConfirm(
                    'Error de OCR',
                    data?.error || 'El servicio de reconocimiento no está disponible.',
                    () => { setIsProcessing(false); setStatusText(''); },
                    { type: 'danger', confirmText: 'Reintentar', cancelText: 'Manual', onCancel: () => onClose() }
                );
                return;
            }

            if (data?.plate || data?.brand || data?.model) {
                const parts = [];
                if (data.plate) parts.push(`Placa: ${data.plate}`);
                if (data.brand) parts.push(data.brand);
                if (data.model) parts.push(data.model);
                console.log('[OCR] Vehículo detectado:', parts.join(' | '));
                setStatusText(`✅ ${parts.join(' • ')}`);
                setTimeout(() => {
                    if (onVehicleScanned) {
                        onVehicleScanned({ plate: data.plate, brand: data.brand, model: data.model });
                    } else if (data.plate) {
                        onPlateScanned(data.plate);
                    }
                }, 800);
            } else {
                console.log('[OCR] No se detectó placa:', data);
                setStatusText('No se detectó placa');
                showConfirm(
                    'Placa no detectada',
                    data?.message || 'Intenta de nuevo acercándote más o con mejor iluminación.',
                    () => { setIsProcessing(false); setStatusText(''); },
                    { type: 'warning', confirmText: 'Reintentar', cancelText: 'Manual', onCancel: () => onClose() }
                );
            }
        } catch (err: any) {
            console.error('[OCR] Exception:', err?.message || err);
            setStatusText('Error de conexión');
            showConfirm(
                'Error de conexión', 
                'No se pudo conectar con el servicio OCR. Verifica tu conexión a internet.', 
                () => { setIsProcessing(false); setStatusText(''); },
                { type: 'danger', confirmText: 'Reintentar', cancelText: 'Manual', onCancel: () => onClose() }
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const takePicture = async () => {
        if (!cameraRef.current) return;
        try {
            setStatusText('Capturando...');
            // Buena calidad para máxima precisión OCR
            const photo = await cameraRef.current.takePictureAsync({ 
                base64: true, 
                quality: 0.7,
                exif: false,
            });
            if (photo?.base64) {
                await processImageOCR(photo.base64);
            }
        } catch (e) {
            console.error("Camera failed:", e);
            setStatusText('Error de cámara');
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
                zoom={zoomLevels[zoomIndex]}
            >
                <View style={styles.overlay}>
                    {/* Header bar */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                            <X color="#ffffff" size={28} />
                        </TouchableOpacity>
                        <View style={styles.titleContainer}>
                            <Text style={styles.headerTitle}>Enfoca la placa del vehículo</Text>
                        </View>
                        <View style={styles.iconButtonSpacer} />
                    </View>

                    {/* Target Box Indicator */}
                    <View style={styles.aimBoxContainer}>
                        <View style={styles.aimBox}>
                            {/* Corner markers */}
                            <View style={[styles.corner, styles.cornerTL]} />
                            <View style={[styles.corner, styles.cornerTR]} />
                            <View style={[styles.corner, styles.cornerBL]} />
                            <View style={[styles.corner, styles.cornerBR]} />
                        </View>
                        <Text style={styles.aimHint}>
                            Centra la placa dentro del recuadro
                        </Text>
                    </View>

                    {/* Footer Controls */}
                    <View style={styles.footer}>
                        {statusText ? (
                            <Text style={styles.statusText}>{statusText}</Text>
                        ) : null}

                        {isProcessing ? (
                            <View style={styles.processingIndicator}>
                                <ActivityIndicator size="large" color="#eab308" />
                                <Text style={styles.processingText}>Procesando con IA...</Text>
                            </View>
                        ) : (
                            <View style={styles.captureContainer}>
                                <View style={styles.zoomButtonSpacer} />
                                <TouchableOpacity onPress={takePicture} style={styles.captureButton}>
                                    <View style={styles.captureInnerCircle}>
                                        <CameraIcon color="#000" size={32} />
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={toggleZoom} style={styles.zoomButton}>
                                    <Text style={styles.zoomButtonText}>{zoomLabels[zoomIndex]}</Text>
                                </TouchableOpacity>
                            </View>
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
        height: 120,
        borderWidth: 2,
        borderColor: 'rgba(234, 179, 8, 0.4)',
        borderRadius: 12,
        backgroundColor: 'transparent',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: '#eab308',
    },
    cornerTL: {
        top: -2,
        left: -2,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 12,
    },
    cornerTR: {
        top: -2,
        right: -2,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 12,
    },
    cornerBL: {
        bottom: -2,
        left: -2,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 12,
    },
    cornerBR: {
        bottom: -2,
        right: -2,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 12,
    },
    aimHint: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        marginTop: 16,
        fontWeight: '500',
    },
    footer: {
        height: 180,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 40,
    },
    statusText: {
        color: '#eab308',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    captureContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    zoomButtonSpacer: {
        width: 50,
        marginRight: 30,
    },
    zoomButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 30,
    },
    zoomButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
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
        color: '#eab308',
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
