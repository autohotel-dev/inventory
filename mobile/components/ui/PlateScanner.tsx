import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { X, Camera as CameraIcon, RotateCcw, Zap, Wifi, WifiOff, CheckCircle } from 'lucide-react-native';
import { useTheme } from '../../contexts/theme-context';
import { useConfirm } from '../../contexts/confirm-context';
import { 
    detectVehicleLocally, 
    detectPlateLocally, 
    formatPlate, 
    isValidMexicanPlate,
    isMLKitAvailable,
    getDetectionCapabilities 
} from '../../lib/local-detection';

export interface VehicleScanResult {
    plate: string | null;
    brand: string | null;
    model: string | null;
    color: string | null;
    confidence?: number;
    source: 'local' | 'cloud' | 'both';
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
    const [capabilities, setCapabilities] = useState<{
        ocr: boolean;
        brandML: boolean;
        fullyLocal: boolean;
    } | null>(null);
    const zoomLevels = [0, 0.03, 0.08];
    const zoomLabels = ['1x', '2x', '3x'];
    const cameraRef = useRef<CameraView>(null);

    // Check capabilities on mount
    useEffect(() => {
        checkCapabilities();
    }, []);

    const checkCapabilities = async () => {
        try {
            const caps = await getDetectionCapabilities();
            setCapabilities(caps);
            console.log('[Scanner] Capabilities:', caps);
        } catch (e) {
            console.log('[Scanner] Error checking capabilities:', e);
        }
    };

    const toggleZoom = () => {
        setZoomIndex((prev) => (prev + 1) % zoomLevels.length);
    };

    // 100% Local detection
    const processImageLocal = async (base64String: string) => {
        setIsProcessing(true);
        setStatusText('Analizando vehículo...');
        
        try {
            // Create data URI for local processing
            const imageUri = `data:image/jpeg;base64,${base64String}`;
            
            // Run local detection (plate + brand + color)
            const result = await detectVehicleLocally(imageUri);
            
            if (result.plate || result.brand || result.color) {
                const parts = [];
                if (result.plate) parts.push(`Placa: ${result.plate}`);
                if (result.brand) parts.push(result.brand);
                if (result.color) parts.push(result.color);
                
                const confText = result.confidence ? ` (${(result.confidence * 100).toFixed(0)}%)` : '';
                
                console.log(`[Scanner] Detectado:`, parts.join(' | '));
                setStatusText(`✅ ${parts.join(' • ')}${confText}`);
                
                setTimeout(() => {
                    if (onVehicleScanned) {
                        onVehicleScanned({
                            plate: result.plate,
                            brand: result.brand,
                            model: null,
                            color: result.color,
                            confidence: result.confidence,
                            source: 'local',
                        });
                    } else if (result.plate) {
                        onPlateScanned(result.plate);
                    }
                }, 800);
            } else {
                setStatusText('No se detectó vehículo');
                showConfirm(
                    'No detectado',
                    'Intenta de nuevo acercándote más o con mejor iluminación. Asegúrate de que la placa sea visible.',
                    () => { setIsProcessing(false); setStatusText(''); },
                    { type: 'warning', confirmText: 'Reintentar', cancelText: 'Manual', onCancel: () => onClose() }
                );
            }
        } catch (err: any) {
            console.error('[Scanner] Error:', err?.message || err);
            setStatusText('Error de procesamiento');
            showConfirm(
                'Error',
                'No se pudo procesar la imagen. Intenta de nuevo.',
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
            const photo = await cameraRef.current.takePictureAsync({ 
                base64: true, 
                quality: 0.8,
                exif: false,
            });
            if (photo?.base64) {
                await processImageLocal(photo.base64);
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
                        <View style={styles.statusBadge}>
                            <Zap size={12} color="#10b981" />
                            <Text style={styles.statusBadgeText}>LOCAL</Text>
                        </View>
                    </View>

                    {/* Target Box Indicator */}
                    <View style={styles.aimBoxContainer}>
                        <View style={styles.aimBox}>
                            <View style={[styles.corner, styles.cornerTL]} />
                            <View style={[styles.corner, styles.cornerTR]} />
                            <View style={[styles.corner, styles.cornerBL]} />
                            <View style={[styles.corner, styles.cornerBR]} />
                        </View>
                        <Text style={styles.aimHint}>
                            ⚡ 100% Local • Sin internet • Toca para escanear
                        </Text>
                        {capabilities && (
                            <View style={styles.capabilitiesRow}>
                                <View style={[styles.capBadge, capabilities.ocr ? styles.capActive : styles.capInactive]}>
                                    <Text style={styles.capText}>OCR</Text>
                                </View>
                                <View style={[styles.capBadge, capabilities.brandML ? styles.capActive : styles.capInactive]}>
                                    <Text style={styles.capText}>Marca</Text>
                                </View>
                                <View style={[styles.capBadge, capabilities.fullyLocal ? styles.capActive : styles.capInactive]}>
                                    <Text style={styles.capText}>Color</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Footer Controls */}
                    <View style={styles.footer}>
                        {statusText ? (
                            <Text style={styles.statusText}>{statusText}</Text>
                        ) : null}

                        {isProcessing ? (
                            <View style={styles.processingIndicator}>
                                <ActivityIndicator size="large" color="#eab308" />
                                <Text style={styles.processingText}>Procesando localmente...</Text>
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
        backgroundColor: 'rgba(0,0,0,0.3)',
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
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    statusBadgeText: {
        color: '#10b981',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
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
        borderColor: 'rgba(16, 185, 129, 0.4)',
        borderRadius: 12,
        backgroundColor: 'transparent',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: '#10b981',
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
    capabilitiesRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    capBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    capActive: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    capInactive: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    capText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    footer: {
        height: 180,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 40,
    },
    statusText: {
        color: '#10b981',
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
        backgroundColor: 'rgba(16, 185, 129, 0.3)',
        borderWidth: 2,
        borderColor: 'rgba(16, 185, 129, 0.5)',
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
        color: '#10b981',
        marginTop: 12,
        fontWeight: 'bold',
        fontSize: 16,
    },
    permissionButton: {
        backgroundColor: '#10b981',
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
