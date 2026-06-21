import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { X, Camera as CameraIcon, RotateCcw, Zap, Wifi, WifiOff } from 'lucide-react-native';
import { useTheme } from '../../contexts/theme-context';
import { useConfirm } from '../../contexts/confirm-context';
import { detectVehicle, loadLabels, checkModelStatus, formatMexicanPlate, isValidMexicanPlate } from '../../lib/ml-detection';

export interface VehicleScanResult {
    plate: string | null;
    brand: string | null;
    model: string | null;
    confidence?: number;
    source: 'local' | 'gemini' | 'both';
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
    const [localModelReady, setLocalModelReady] = useState(false);
    const [detectionMode, setDetectionMode] = useState<'auto' | 'local' | 'cloud'>('auto');
    const zoomLevels = [0, 0.03, 0.08];
    const zoomLabels = ['1x', '2x', '3x'];
    const cameraRef = useRef<CameraView>(null);

    // Check local model on mount
    useEffect(() => {
        checkLocalModel();
    }, []);

    const checkLocalModel = async () => {
        try {
            await loadLabels();
            const status = await checkModelStatus();
            setLocalModelReady(status.ready);
            console.log('[Scanner] Local model status:', status);
        } catch (e) {
            console.log('[Scanner] Local model not available:', e);
            setLocalModelReady(false);
        }
    };

    const toggleZoom = () => {
        setZoomIndex((prev) => (prev + 1) % zoomLevels.length);
    };

    const toggleMode = () => {
        setDetectionMode(prev => {
            if (prev === 'auto') return 'local';
            if (prev === 'local') return 'cloud';
            return 'auto';
        });
    };

    // Local ML detection (fast, uses our trained model via Edge Function)
    const processLocal = async (base64String: string): Promise<VehicleScanResult | null> => {
        try {
            setStatusText('Analizando con modelo local...');
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
            
            const response = await fetch(`${supabaseUrl}/functions/v1/vehicle-classifier`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({ image: base64String }),
            });

            if (!response.ok) {
                console.log('[Scanner] Vehicle classifier failed:', response.status);
                return null;
            }

            const data = await response.json();
            
            if (data.brand && data.confidence > 0.5) {
                return {
                    plate: null,
                    brand: data.brand,
                    model: null,
                    confidence: data.confidence,
                    source: 'local',
                };
            }
            return null;
        } catch (e) {
            console.log('[Scanner] Local detection failed:', e);
            return null;
        }
    };

    // Cloud Gemini detection (slower, needs network, does plate OCR)
    const processCloud = async (base64String: string): Promise<VehicleScanResult | null> => {
        try {
            setStatusText('Analizando con Gemini...');
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

            if (response.ok && (data?.plate || data?.brand || data?.model)) {
                return {
                    plate: data.plate || null,
                    brand: data.brand || null,
                    model: data.model || null,
                    source: 'gemini',
                };
            }
            return null;
        } catch (e) {
            console.log('[Scanner] Cloud detection failed:', e);
            return null;
        }
    };

    const processImage = async (base64String: string) => {
        setIsProcessing(true);
        setStatusText('Capturando imagen...');
        
        try {
            let result: VehicleScanResult | null = null;

            if (detectionMode === 'local' && localModelReady) {
                // Local only
                result = await processLocal(base64String);
            } else if (detectionMode === 'cloud') {
                // Cloud only
                result = await processCloud(base64String);
            } else {
                // Auto: try local first, then cloud
                if (localModelReady) {
                    result = await processLocal(base64String);
                    if (result) {
                        // Got local result, also try cloud for plate
                        setStatusText('Detectando placa...');
                        const cloudResult = await processCloud(base64String);
                        if (cloudResult?.plate) {
                            result.plate = cloudResult.plate;
                            result.source = 'both';
                        }
                    }
                }
                
                // If local failed or not available, try cloud
                if (!result) {
                    result = await processCloud(base64String);
                }
            }

            if (result) {
                const parts = [];
                if (result.plate) parts.push(`Placa: ${formatMexicanPlate(result.plate)}`);
                if (result.brand) parts.push(result.brand);
                if (result.model) parts.push(result.model);
                
                const sourceIcon = result.source === 'local' ? '⚡' : result.source === 'both' ? '🔄' : '☁️';
                const confText = result.confidence ? ` (${(result.confidence * 100).toFixed(0)}%)` : '';
                
                console.log(`[Scanner] ${sourceIcon} Detectado:`, parts.join(' | '));
                setStatusText(`✅ ${parts.join(' • ')}${confText}`);
                
                setTimeout(() => {
                    if (onVehicleScanned) {
                        onVehicleScanned(result!);
                    } else if (result?.plate) {
                        onPlateScanned(result.plate);
                    }
                }, 800);
            } else {
                setStatusText('No se detectó vehículo');
                showConfirm(
                    'No detectado',
                    'Intenta de nuevo acercándote más o con mejor iluminación.',
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
                quality: 0.7,
                exif: false,
            });
            if (photo?.base64) {
                await processImage(photo.base64);
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

    const getModeIcon = () => {
        if (detectionMode === 'local') return <Zap size={14} color="#10b981" />;
        if (detectionMode === 'cloud') return <Wifi size={14} color="#3b82f6" />;
        return localModelReady ? <Zap size={14} color="#eab308" /> : <Wifi size={14} color="#3b82f6" />;
    };

    const getModeLabel = () => {
        if (detectionMode === 'local') return 'Local';
        if (detectionMode === 'cloud') return 'Nube';
        return localModelReady ? 'Auto' : 'Nube';
    };

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
                        <TouchableOpacity onPress={toggleMode} style={styles.modeButton}>
                            {getModeIcon()}
                            <Text style={styles.modeButtonText}>{getModeLabel()}</Text>
                        </TouchableOpacity>
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
                            {localModelReady 
                                ? '⚡ IA local activa • Toca para escanear'
                                : '☁️ Conectado a Gemini • Toca para escanear'
                            }
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
                                <Text style={styles.processingText}>
                                    {detectionMode === 'local' ? 'Procesando localmente...' : 'Procesando con IA...'}
                                </Text>
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
    modeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
    },
    modeButtonText: {
        color: '#fff',
        fontSize: 12,
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
