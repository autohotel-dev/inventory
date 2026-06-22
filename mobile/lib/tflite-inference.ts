/**
 * Local TFLite Inference Module
 * Uses react-native-fast-tflite for native GPU-accelerated inference
 * 100% on-device, no internet required
 */

import { TensorflowModel, loadTensorflowModel, TensorflowModelDelegate } from 'react-native-fast-tflite';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

// Model configuration (matches training config)
const MODEL_CONFIG = {
    inputSize: 224,
    numClasses: 301,
    mean: [0.485, 0.456, 0.406] as const,
    std: [0.229, 0.224, 0.225] as const,
};

// State
let model: TensorflowModel | null = null;
let labels: Record<string, string> = {};
let isModelLoaded = false;
let isLabelsLoaded = false;

/**
 * Load the TFLite model from bundled assets
 * Uses expo-asset to resolve the file path, then loads via file URI
 */
export async function loadModel(): Promise<boolean> {
    try {
        if (isModelLoaded && model) return true;

        console.log('[TFLite] Loading model...');

        // Resolve asset to local file URI using expo-asset
        const [asset] = await Asset.loadAsync(
            require('../assets/models/vehicle_model_final_float32.tflite')
        );

        if (!asset.localUri) {
            console.error('[TFLite] Could not resolve model asset to local URI');
            return false;
        }

        console.log('[TFLite] Model asset resolved:', asset.localUri);

        // Try CPU first (most compatible, works on emulators)
        try {
            model = await loadTensorflowModel(
                { url: asset.localUri },
                []
            );
            isModelLoaded = true;
            console.log('[TFLite] Model loaded (CPU)');
            return true;
        } catch (cpuError) {
            console.warn('[TFLite] CPU load failed:', cpuError);
        }

        // Try GPU delegate (faster on real devices)
        try {
            const gpuDelegate: TensorflowModelDelegate = Platform.OS === 'ios' ? 'core-ml' : 'android-gpu';
            model = await loadTensorflowModel(
                { url: asset.localUri },
                [gpuDelegate]
            );
            isModelLoaded = true;
            console.log('[TFLite] Model loaded (GPU)');
            return true;
        } catch (gpuError) {
            console.error('[TFLite] GPU load also failed:', gpuError);
        }

        return false;
    } catch (error) {
        console.error('[TFLite] Failed to load model:', error);
        return false;
    }
}

/**
 * Load vehicle labels from bundled JSON
 */
export async function loadLabels(): Promise<boolean> {
    try {
        if (isLabelsLoaded && Object.keys(labels).length > 0) return true;

        // Load from bundled asset
        const labelsData = require('../assets/models/vehicle_model_labels.json');
        labels = labelsData;
        isLabelsLoaded = true;

        console.log(`[TFLite] Loaded ${Object.keys(labels).length} labels`);
        return true;
    } catch (error) {
        console.error('[TFLite] Failed to load labels:', error);
        return false;
    }
}

/**
 * Initialize model and labels
 */
export async function initialize(): Promise<boolean> {
    const [modelOk, labelsOk] = await Promise.all([
        loadModel(),
        loadLabels(),
    ]);
    return modelOk && labelsOk;
}

/**
 * Preprocess image for model input
 * Pipeline: URI → resize 224×224 → JPEG base64 → decode pixels → normalize → NHWC tensor
 */
async function preprocessImage(imageUri: string): Promise<Float32Array | null> {
    try {
        const ImageManipulator = require('expo-image-manipulator');

        // Step 1: Resize image to 224×224 and get base64 JPEG
        const manipulated = await ImageManipulator.manipulateAsync(
            imageUri,
            [{ resize: { width: MODEL_CONFIG.inputSize, height: MODEL_CONFIG.inputSize } }],
            { compress: 1, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        if (!manipulated.base64) {
            console.error('[TFLite] Failed to get base64 from manipulated image');
            return null;
        }

        // Step 2: Decode base64 to bytes
        const binaryString = atob(manipulated.base64);
        const jpegBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            jpegBytes[i] = binaryString.charCodeAt(i);
        }

        // Step 3: Decode JPEG to raw RGBA pixels
        const jpeg = require('jpeg-js');
        const decoded = jpeg.decode(jpegBytes, { useTArray: true, formatAsRGBA: true });

        if (!decoded || !decoded.data) {
            console.error('[TFLite] JPEG decode failed');
            return null;
        }

        const { width, height, data: rgbaPixels } = decoded;

        // Step 4: Create normalized Float32Array in NHWC format [1, 224, 224, 3]
        const size = MODEL_CONFIG.inputSize;
        const inputData = new Float32Array(size * size * 3);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Map to source pixel (in case resize wasn't exact)
                const srcX = Math.min(Math.floor((x / size) * width), width - 1);
                const srcY = Math.min(Math.floor((y / size) * height), height - 1);
                const srcIdx = (srcY * width + srcX) * 4; // RGBA

                const dstIdx = (y * size + x) * 3; // RGB in NHWC

                // Normalize: (pixel/255 - mean) / std
                inputData[dstIdx + 0] = (rgbaPixels[srcIdx + 0] / 255 - MODEL_CONFIG.mean[0]) / MODEL_CONFIG.std[0]; // R
                inputData[dstIdx + 1] = (rgbaPixels[srcIdx + 1] / 255 - MODEL_CONFIG.mean[1]) / MODEL_CONFIG.std[1]; // G
                inputData[dstIdx + 2] = (rgbaPixels[srcIdx + 2] / 255 - MODEL_CONFIG.mean[2]) / MODEL_CONFIG.std[2]; // B
            }
        }

        return inputData;
    } catch (error) {
        console.error('[TFLite] Image preprocessing error:', error);
        return null;
    }
}

/**
 * Apply softmax to raw logits
 */
function softmax(logits: number[]): number[] {
    const maxLogit = Math.max(...logits);
    const exps = logits.map(l => Math.exp(l - maxLogit));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sumExps);
}

/**
 * Parse a label string "Brand_Model_SubModel" into brand and model
 */
function parseLabel(label: string): { brand: string; model: string } {
    const parts = label.split('_');
    if (parts.length === 0) return { brand: 'Unknown', model: 'Unknown' };

    // Handle hyphenated brands like "Mercedes-Benz"
    const brand = parts[0];
    const modelName = parts.slice(1).join(' ') || 'Unknown';

    return { brand, model: modelName };
}

export interface TFLitePrediction {
    brand: string;
    model: string;
    label: string;
    confidence: number;
}

/**
 * Get top N predictions from model output
 */
function getTopPredictions(probabilities: number[], n: number = 3): TFLitePrediction[] {
    const indexed = probabilities.map((conf, idx) => {
        const label = labels[idx.toString()] || `Unknown_${idx}`;
        const parsed = parseLabel(label);
        return {
            idx,
            conf,
            brand: parsed.brand,
            model: parsed.model,
            label,
        };
    });

    indexed.sort((a, b) => b.conf - a.conf);

    return indexed.slice(0, n).map(item => ({
        brand: item.brand,
        model: item.model,
        label: item.label,
        confidence: Math.round(item.conf * 1000) / 1000,
    }));
}

/**
 * Run TFLite inference on an image
 * Returns the top prediction with brand, model, and confidence
 */
export async function runLocalInference(imageUri: string): Promise<{
    brand: string;
    model: string;
    label: string;
    confidence: number;
    topPredictions: TFLitePrediction[];
    processingTime: number;
} | null> {
    try {
        const startTime = Date.now();

        // Ensure model is loaded
        if (!isModelLoaded || !model) {
            const initialized = await initialize();
            if (!initialized) {
                console.log('[TFLite] Failed to initialize');
                return null;
            }
        }

        // Preprocess image
        const inputTensor = await preprocessImage(imageUri);
        if (!inputTensor) {
            console.log('[TFLite] Failed to preprocess image');
            return null;
        }

        // Run inference — API expects ArrayBuffer[], returns ArrayBuffer[]
        const inputBuffer = inputTensor.buffer as ArrayBuffer;
        const outputBuffers = await model!.run([inputBuffer]);
        const rawOutput = Array.from(new Float32Array(outputBuffers[0]));

        // Apply softmax to get probabilities
        const probabilities = softmax(rawOutput);

        // Get top predictions
        const topPredictions = getTopPredictions(probabilities, 5);
        if (topPredictions.length === 0) {
            return null;
        }

        const best = topPredictions[0];
        const processingTime = Date.now() - startTime;

        console.log(`[TFLite] Inference completed in ${processingTime}ms — ${best.brand} ${best.model} (${(best.confidence * 100).toFixed(1)}%)`);

        return {
            brand: best.brand,
            model: best.model,
            label: best.label,
            confidence: best.confidence,
            topPredictions,
            processingTime,
        };
    } catch (error) {
        console.error('[TFLite] Inference error:', error);
        return null;
    }
}

/**
 * Check if TFLite inference is available and ready
 */
export function isReady(): boolean {
    return isModelLoaded && isLabelsLoaded && model !== null;
}

/**
 * Get all unique brand names from labels
 */
export function getAvailableBrands(): string[] {
    return [...new Set(Object.values(labels).map(l => parseLabel(l).brand))];
}

/**
 * Get all models for a specific brand
 */
export function getModelsForBrand(brand: string): string[] {
    return Object.values(labels)
        .map(l => parseLabel(l))
        .filter(p => p.brand.toLowerCase() === brand.toLowerCase())
        .map(p => p.model);
}

/**
 * Release model resources
 */
export function dispose(): void {
    // react-native-fast-tflite doesn't have an explicit dispose,
    // but we can null out our references
    model = null;
    isModelLoaded = false;
    console.log('[TFLite] Model disposed');
}
