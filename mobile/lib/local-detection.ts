/**
 * Local Vehicle Detection Module
 * 100% on-device, no internet required
 * 
 * Components:
 * - ML Kit Text Recognition: Plate OCR
 * - MobileNetV3 (via Edge Function): Brand classification
 * - Image Analysis: Color detection
 * - Regex: Mexican plate validation
 */

import { Platform } from 'react-native';
import { analyzeImageColor, ColorResult } from './color-detection';
import { runLocalInference, initialize as initTFLite } from './tflite-inference';

// Mexican plate patterns
const PLATE_PATTERNS = [
    /^[A-Z]{3}-\d{3}$/,           // ABC-123
    /^[A-Z]{3}-\d{2}-\d{2}$/,     // ABC-12-34
    /^\d{3}-[A-Z]{3}$/,           // 123-ABC
    /^[A-Z]{2}-\d{4}$/,           // AB-1234
    /^[A-Z]{3}\d{3}$/,            // ABC123 (without dash)
    /^[A-Z]{3}\d{4}$/,            // ABC1234 (without dash)
];

export interface LocalDetectionResult {
    plate: string | null;
    brand: string | null;
    model: string | null;
    color: string | null;
    confidence: number;
    processingTime: number;
    source: 'local-ocr' | 'local-ml' | 'local-color' | 'local-all';
}

export interface PlateOCRResult {
    text: string;
    confidence: number;
    bbox?: { x: number; y: number; width: number; height: number };
}

/**
 * Format raw OCR text to Mexican plate format
 */
export function formatPlate(rawText: string): string | null {
    // Remove all non-alphanumeric characters
    const cleaned = rawText.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // Try to match known patterns
    for (const pattern of PLATE_PATTERNS) {
        if (pattern.test(cleaned)) {
            // Add dash formatting
            if (cleaned.length === 6 && /^[A-Z]{3}\d{3}$/.test(cleaned)) {
                return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
            }
            if (cleaned.length === 7 && /^[A-Z]{3}\d{4}$/.test(cleaned)) {
                return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
            }
            return cleaned;
        }
    }
    
    // If no pattern matches but looks like a plate (3 letters + 3-4 numbers)
    if (/^[A-Z]{3}\d{3,4}$/.test(cleaned)) {
        if (cleaned.length === 6) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
        }
        if (cleaned.length === 7) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
        }
    }
    
    return null;
}

/**
 * Validate if a string looks like a Mexican plate
 */
export function isValidMexicanPlate(text: string): boolean {
    const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return PLATE_PATTERNS.some(pattern => pattern.test(cleaned));
}

/**
 * Extract plate from OCR text using pattern matching
 */
export function extractPlateFromText(ocrText: string): string | null {
    // Split by lines and try each
    const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    for (const line of lines) {
        const formatted = formatPlate(line);
        if (formatted) {
            return formatted;
        }
    }
    
    // Try to find plate pattern in combined text
    const combined = ocrText.replace(/\s+/g, '');
    const formatted = formatPlate(combined);
    if (formatted) {
        return formatted;
    }
    
    return null;
}

/**
 * Run ML Kit Text Recognition on image
 * Returns raw OCR text
 */
export async function recognizeText(imageUri: string): Promise<string> {
    try {
        // Dynamic import for ML Kit (may not be available in all environments)
        const TextRecognition = require('@react-native-ml-kit/text-recognition');
        
        const result = await TextRecognition.default.recognize(imageUri);
        return result.text || '';
    } catch (error) {
        console.error('[OCR] ML Kit error:', error);
        // Fallback: try to use Tesseract or other OCR
        return '';
    }
}

/**
 * Local plate detection using ML Kit OCR
 */
export async function detectPlateLocally(imageUri: string): Promise<PlateOCRResult | null> {
    try {
        const startTime = Date.now();
        
        // Run OCR
        const ocrText = await recognizeText(imageUri);
        
        if (!ocrText || ocrText.trim().length === 0) {
            console.log('[OCR] No text detected');
            return null;
        }
        
        console.log('[OCR] Raw text:', ocrText.substring(0, 100));
        
        // Extract plate from text
        const plate = extractPlateFromText(ocrText);
        
        if (!plate) {
            console.log('[OCR] No plate pattern found in text');
            return null;
        }
        
        const processingTime = Date.now() - startTime;
        console.log(`[OCR] Plate detected: ${plate} (${processingTime}ms)`);
        
        return {
            text: plate,
            confidence: 0.85, // ML Kit doesn't provide confidence, use default
        };
    } catch (error) {
        console.error('[OCR] Detection error:', error);
        return null;
    }
}

/**
 * Combined local detection: OCR for plate + ML for brand + Color analysis
 */
export async function detectVehicleLocally(imageUri: string): Promise<LocalDetectionResult> {
    const startTime = Date.now();
    
    // Run plate OCR, brand detection, and color analysis in parallel
    const [plateResult, brandResult, colorResult] = await Promise.allSettled([
        detectPlateLocally(imageUri),
        detectBrandLocally(imageUri),
        detectColorLocally(imageUri),
    ]);
    
    const plate = plateResult.status === 'fulfilled' ? plateResult.value : null;
    const brand = brandResult.status === 'fulfilled' ? brandResult.value : null;
    const color = colorResult.status === 'fulfilled' ? colorResult.value : null;
    
    const processingTime = Date.now() - startTime;
    
    // Determine source
    let source: LocalDetectionResult['source'] = 'local-all';
    const hasPlate = !!plate;
    const hasBrand = !!brand;
    const hasColor = !!color;
    
    if (hasPlate && hasBrand && hasColor) source = 'local-all';
    else if (hasPlate && hasBrand) source = 'local-all';
    else if (hasPlate) source = 'local-ocr';
    else if (hasBrand) source = 'local-ml';
    else if (hasColor) source = 'local-color';
    
    return {
        plate: plate?.text || null,
        brand: brand?.brand || null,
        model: brand?.model || null,
        color: color?.color || null,
        confidence: brand?.confidence || 0,
        processingTime,
        source,
    };
}

/**
 * Brand detection using on-device TFLite model
 * 100% local, no internet required
 */
async function detectBrandLocally(imageUri: string): Promise<{ brand: string; model: string; confidence: number } | null> {
    try {
        const result = await runLocalInference(imageUri);
        
        // Debug: always log what the model sees
        if (result) {
            console.log(`[ML] TFLite top prediction: ${result.brand} ${result.model} (${(result.confidence * 100).toFixed(1)}%)`);
            console.log('[ML] Top 5:', result.topPredictions.map(p => `${p.brand} ${p.model}: ${(p.confidence * 100).toFixed(1)}%`).join(' | '));
        } else {
            console.log('[ML] TFLite returned null (model not loaded or preprocessing failed)');
        }
        
        if (result && result.confidence > 0.15) {
            return {
                brand: result.brand,
                model: result.model,
                confidence: result.confidence,
            };
        }
        console.log('[ML] Confidence too low, skipping brand detection');
        return null;
    } catch (error) {
        console.error('[ML] TFLite brand detection error:', error);
        return null;
    }
}

/**
 * Color detection using image analysis
 */
async function detectColorLocally(imageUri: string): Promise<ColorResult | null> {
    try {
        // For React Native, we need to use a canvas or image manipulation library
        // For now, return a placeholder that indicates color detection needs canvas
        
        // TODO: Implement with expo-image-manipulator or react-native-canvas
        // The analyzeImageColor function needs raw pixel data from a canvas
        
        console.log('[Color] Color detection requires canvas implementation');
        return null;
    } catch (error) {
        console.error('[Color] Detection error:', error);
        return null;
    }
}

/**
 * Check if ML Kit is available
 */
export async function isMLKitAvailable(): Promise<boolean> {
    try {
        require('@react-native-ml-kit/text-recognition');
        return true;
    } catch {
        return false;
    }
}

/**
 * Get detection capabilities
 */
export async function getDetectionCapabilities(): Promise<{
    ocr: boolean;
    brandML: boolean;
    fullyLocal: boolean;
}> {
    const ocrAvailable = await isMLKitAvailable();
    const tfliteReady = await initTFLite();
    
    return {
        ocr: ocrAvailable,
        brandML: tfliteReady, // Now truly local via TFLite
        fullyLocal: ocrAvailable && tfliteReady,
    };
}
