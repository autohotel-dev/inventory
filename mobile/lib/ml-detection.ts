/**
 * Vehicle Detection ML Module
 * Uses TFLite for on-device brand/model classification
 * Falls back to Supabase Edge Function if TFLite is unavailable
 *
 * Flow: Cochero toma foto → TFLite clasifica → auto-rellena formulario
 */

import { Platform } from 'react-native';
import { analyzeImageColor, ColorResult } from './color-detection';
import {
    initialize as initTFLite,
    runLocalInference,
    isReady as isTFLiteReady,
    getAvailableBrands as getTFLiteBrands,
    TFLitePrediction,
} from './tflite-inference';

// Mexican plate patterns
const PLATE_PATTERNS = [
    /^[A-Z]{3}-\d{3}$/,           // ABC-123
    /^[A-Z]{3}-\d{2}-\d{2}$/,     // ABC-12-34
    /^\d{3}-[A-Z]{3}$/,           // 123-ABC
    /^[A-Z]{2}-\d{4}$/,           // AB-1234
];

export interface DetectionResult {
    brand: string;
    model: string;
    car_type: string;
    confidence: number;
    topPredictions: TFLitePrediction[];
    processingTime: number;
    source: 'tflite' | 'edge-function' | 'fallback';
}

export interface ModelStatus {
    loaded: boolean;
    labelsLoaded: boolean;
    ready: boolean;
}

/**
 * Format raw text to Mexican license plate format
 */
export function formatMexicanPlate(plate: string): string {
    let cleaned = plate.replace(/[^A-Z0-9]/g, '').toUpperCase();

    if (cleaned.length === 6 && /^[A-Z]{3}\d{3}$/.test(cleaned)) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    }

    if (cleaned.length === 7 && /^[A-Z]{3}\d{4}$/.test(cleaned)) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
    }

    return cleaned;
}

/**
 * Validate Mexican license plate format
 */
export function isValidMexicanPlate(plate: string): boolean {
    const cleaned = plate.replace(/[^A-Z0-9]/g, '').toUpperCase();
    return PLATE_PATTERNS.some(pattern => pattern.test(cleaned));
}

/**
 * Check model status
 */
export async function checkModelStatus(): Promise<ModelStatus> {
    const ready = isTFLiteReady();
    return {
        loaded: ready,
        labelsLoaded: ready,
        ready,
    };
}

/**
 * Pre-load model and labels (call early, e.g., on app start)
 */
export async function loadLabels(): Promise<boolean> {
    try {
        return await initTFLite();
    } catch {
        return false;
    }
}

/**
 * Detect vehicle brand and model from a photo
 * Primary: TFLite on-device → Fallback: Supabase Edge Function
 */
export async function detectVehicle(imageUri: string): Promise<DetectionResult> {
    const startTime = Date.now();

    // ── Try TFLite local inference first (100% offline) ──
    try {
        const localResult = await runLocalInference(imageUri);
        if (localResult && localResult.confidence > 0.35) {
            return {
                brand: localResult.brand,
                model: localResult.model,
                car_type: '',
                confidence: localResult.confidence,
                topPredictions: localResult.topPredictions,
                processingTime: Date.now() - startTime,
                source: 'tflite',
            };
        }
        console.log('[ML] TFLite confidence too low, trying Edge Function...');
    } catch (error) {
        console.log('[ML] TFLite inference failed, trying Edge Function...', error);
    }

    // ── Fallback: Supabase Edge Function ──
    try {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase not configured');
        }

        // Read image as base64
        let base64Image = imageUri;
        if (imageUri.startsWith('file://') || imageUri.startsWith('/')) {
            const FileSystem = require('expo-file-system');
            base64Image = await FileSystem.readAsStringAsync(imageUri, {
                encoding: FileSystem.EncodingType.Base64,
            });
        } else if (imageUri.startsWith('data:')) {
            base64Image = imageUri.split(',')[1];
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/vehicle-classifier`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ image: base64Image }),
        });

        if (!response.ok) {
            throw new Error(`Edge Function failed: ${response.status}`);
        }

        const data = await response.json();

        return {
            brand: data.brand || 'Unknown',
            model: data.model || 'Unknown',
            car_type: data.car_type || '',
            confidence: data.confidence || 0,
            topPredictions: data.top3 || [],
            processingTime: Date.now() - startTime,
            source: 'edge-function',
        };
    } catch (edgeError) {
        console.error('[ML] Edge Function also failed:', edgeError);
    }

    // ── Both failed ──
    return {
        brand: 'Unknown',
        model: 'Unknown',
        car_type: '',
        confidence: 0,
        topPredictions: [],
        processingTime: Date.now() - startTime,
        source: 'fallback',
    };
}

/**
 * Get all loaded brand names
 */
export function getLoadedBrands(): string[] {
    return getTFLiteBrands();
}

/**
 * Check if a brand is in our model
 */
export function isKnownBrand(brand: string): boolean {
    return getTFLiteBrands().some(
        b => b.toLowerCase() === brand.toLowerCase()
    );
}
