/**
 * Vehicle Detection ML Module
 * Local inference for vehicle brand/model/color/plate detection
 */

import * as FileSystem from 'expo-file-system';

// Model paths
const MODEL_DIR = `${FileSystem.documentDirectory}ml-models/`;
const YOLO_MODEL = `${MODEL_DIR}yolo_plate.tflite`;
const CLASSIFIER_MODEL = `${MODEL_DIR}mobilenet_vehicle.tflite`;
const LABELS_FILE = `${MODEL_DIR}vehicle_labels.json`;

export interface DetectionResult {
    plate: {
        text: string;
        confidence: number;
        bbox?: [number, number, number, number];
    };
    vehicle: {
        brand: string;
        model: string;
        color: string;
        confidence: number;
    };
    processingTime: number;
}

export interface ModelStatus {
    yolo: boolean;
    classifier: boolean;
    labels: boolean;
    ready: boolean;
}

/**
 * Check if ML models are downloaded and ready
 */
export async function checkModelStatus(): Promise<ModelStatus> {
    const yoloExists = await FileSystem.getInfoAsync(YOLO_MODEL);
    const classifierExists = await FileSystem.getInfoAsync(CLASSIFIER_MODEL);
    const labelsExists = await FileSystem.getInfoAsync(LABELS_FILE);

    return {
        yolo: yoloExists.exists,
        classifier: classifierExists.exists,
        labels: labelsExists.exists,
        ready: yoloExists.exists && classifierExists.exists && labelsExists.exists
    };
}

/**
 * Download ML models from server
 */
export async function downloadModels(
    onProgress?: (progress: number) => void
): Promise<boolean> {
    try {
        // Create model directory
        await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });

        // TODO: Download models from Supabase Storage or CDN
        // For now, return false indicating models need to be bundled
        console.log('[ML] Models need to be bundled with app or downloaded from server');
        return false;
    } catch (error) {
        console.error('[ML] Error downloading models:', error);
        return false;
    }
}

/**
 * Load class labels from JSON file
 */
async function loadLabels(): Promise<Record<number, string>> {
    try {
        const labelsJson = await FileSystem.readAsStringAsync(LABELS_FILE);
        return JSON.parse(labelsJson);
    } catch (error) {
        console.error('[ML] Error loading labels:', error);
        return {};
    }
}

/**
 * Preprocess image for model input
 * Converts image to normalized tensor
 */
function preprocessImage(
    imageUri: string,
    targetWidth: number,
    targetHeight: number
): Promise<Float32Array> {
    // TODO: Implement image preprocessing
    // 1. Load image from URI
    // 2. Resize to target dimensions
    // 3. Normalize pixel values (0-1 or -1 to 1)
    // 4. Convert to Float32Array
    
    return Promise.resolve(new Float32Array(targetWidth * targetHeight * 3));
}

/**
 * Run YOLO inference for object detection
 * Returns bounding boxes for vehicle and license plate
 */
async function runYoloInference(
    imageData: Float32Array,
    imageWidth: number,
    imageHeight: number
): Promise<Array<{
    class: string;
    confidence: number;
    bbox: [number, number, number, number];
}>> {
    // TODO: Implement TFLite inference
    // 1. Load YOLO model
    // 2. Run inference
    // 3. Apply NMS (Non-Maximum Suppression)
    // 4. Return detections
    
    return [];
}

/**
 * Run MobileNet inference for vehicle classification
 * Returns brand, model, and color predictions
 */
async function runClassifierInference(
    imageData: Float32Array
): Promise<{
    brand: string;
    model: string;
    color: string;
    confidence: number;
}> {
    // TODO: Implement TFLite inference
    // 1. Load MobileNet model
    // 2. Run inference
    // 3. Get top predictions
    // 4. Map to class labels
    
    return {
        brand: 'Unknown',
        model: 'Unknown',
        color: 'Unknown',
        confidence: 0
    };
}

/**
 * Run OCR on license plate image
 * Returns extracted text
 */
async function runPlateOcr(
    plateImageData: Float32Array,
    plateWidth: number,
    plateHeight: number
): Promise<{
    text: string;
    confidence: number;
}> {
    // TODO: Implement ML Kit Text Recognition
    // 1. Prepare plate image
    // 2. Run text recognition
    // 3. Apply regex for Mexican plate format
    // 4. Return formatted plate text
    
    return {
        text: '',
        confidence: 0
    };
}

/**
 * Main detection function
 * Runs complete pipeline on an image
 */
export async function detectVehicle(
    imageUri: string,
    options: {
        detectPlate?: boolean;
        classifyVehicle?: boolean;
        ocrPlate?: boolean;
    } = {}
): Promise<DetectionResult> {
    const startTime = Date.now();
    
    const {
        detectPlate = true,
        classifyVehicle = true,
        ocrPlate = true
    } = options;

    // Check if models are ready
    const status = await checkModelStatus();
    if (!status.ready) {
        throw new Error('ML models not ready. Download models first.');
    }

    // Load labels
    const labels = await loadLabels();

    // Preprocess image (640x640 for YOLO)
    const yoloInput = await preprocessImage(imageUri, 640, 640);

    // Step 1: Detect objects with YOLO
    const detections = await runYoloInference(yoloInput, 640, 640);
    
    // Find vehicle and plate detections
    const vehicleDet = detections.find(d => d.class === 'vehicle');
    const plateDet = detections.find(d => d.class === 'license_plate');

    // Step 2: Classify vehicle if detected
    let classification = {
        brand: 'Unknown',
        model: 'Unknown',
        color: 'Unknown',
        confidence: 0
    };

    if (classifyVehicle && vehicleDet) {
        // Crop vehicle from image
        const vehicleInput = await preprocessImage(imageUri, 224, 224);
        classification = await runClassifierInference(vehicleInput);
    }

    // Step 3: OCR plate if detected
    let plateOcr = {
        text: '',
        confidence: 0
    };

    if (ocrPlate && plateDet) {
        // Crop plate from image
        const plateInput = await preprocessImage(imageUri, 320, 80);
        plateOcr = await runPlateOcr(plateInput, 320, 80);
    }

    const processingTime = Date.now() - startTime;

    return {
        plate: {
            text: plateOcr.text,
            confidence: plateDet?.confidence || 0,
            bbox: plateDet?.bbox
        },
        vehicle: {
            brand: classification.brand,
            model: classification.model,
            color: classification.color,
            confidence: classification.confidence
        },
        processingTime
    };
}

/**
 * Format Mexican license plate
 * Applies regex patterns for standard formats
 */
export function formatMexicanPlate(plate: string): string {
    // Remove spaces and special chars
    let cleaned = plate.replace(/[^A-Z0-9]/g, '').toUpperCase();
    
    // Standard format: ABC-123
    if (cleaned.length === 6) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    }
    
    // New format: ABC-12-34
    if (cleaned.length === 7) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
    }
    
    return cleaned;
}

/**
 * Validate Mexican license plate format
 */
export function isValidMexicanPlate(plate: string): boolean {
    const patterns = [
        /^[A-Z]{3}-\d{3}$/,           // ABC-123
        /^[A-Z]{3}-\d{2}-\d{2}$/,     // ABC-12-34
        /^\d{3}-[A-Z]{3}$/,           // 123-ABC
        /^[A-Z]{2}-\d{4}$/,           // AB-1234 (diplomatic)
    ];
    
    return patterns.some(pattern => pattern.test(plate));
}
