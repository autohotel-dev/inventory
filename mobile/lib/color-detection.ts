/**
 * Vehicle Color Detection Module
 * Analyzes image to detect dominant vehicle color
 * 100% local, no internet required
 */

// Color definitions with HSV ranges
const COLOR_RANGES = [
    { name: 'Blanco', minH: 0, maxH: 360, minS: 0, maxS: 0.2, minV: 0.8, maxV: 1.0 },
    { name: 'Negro', minH: 0, maxH: 360, minS: 0, maxS: 1.0, minV: 0, maxV: 0.2 },
    { name: 'Gris', minH: 0, maxH: 360, minS: 0, maxS: 0.15, minV: 0.2, maxV: 0.8 },
    { name: 'Plata', minH: 0, maxH: 360, minS: 0, maxS: 0.1, minV: 0.6, maxV: 0.85 },
    { name: 'Rojo', minH: 345, maxH: 360, minS: 0.4, maxS: 1.0, minV: 0.3, maxV: 1.0 },
    { name: 'Rojo', minH: 0, maxH: 15, minS: 0.4, maxS: 1.0, minV: 0.3, maxV: 1.0 },
    { name: 'Naranja', minH: 15, maxH: 40, minS: 0.5, maxS: 1.0, minV: 0.5, maxV: 1.0 },
    { name: 'Amarillo', minH: 40, maxH: 65, minS: 0.5, maxS: 1.0, minV: 0.5, maxV: 1.0 },
    { name: 'Verde', minH: 65, maxH: 170, minS: 0.3, maxS: 1.0, minV: 0.2, maxV: 1.0 },
    { name: 'Azul', minH: 170, maxH: 260, minS: 0.3, maxS: 1.0, minV: 0.2, maxV: 1.0 },
    { name: 'Morado', minH: 260, maxH: 310, minS: 0.3, maxS: 1.0, minV: 0.2, maxV: 1.0 },
    { name: 'Rosa', minH: 310, maxH: 345, minS: 0.3, maxS: 0.7, minV: 0.5, maxV: 1.0 },
    { name: 'Café', minH: 15, maxH: 40, minS: 0.3, maxS: 0.8, minV: 0.15, maxV: 0.5 },
    { name: 'Beige', minH: 30, maxH: 50, minS: 0.15, maxS: 0.4, minV: 0.6, maxV: 0.85 },
];

export interface ColorResult {
    color: string;
    confidence: number;
    rgb: { r: number; g: number; b: number };
}

/**
 * Convert RGB to HSV
 */
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (d !== 0) {
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return { h: h * 360, s, v };
}

/**
 * Classify a single pixel's color
 */
function classifyPixel(r: number, g: number, b: number): string {
    const hsv = rgbToHsv(r, g, b);
    
    for (const range of COLOR_RANGES) {
        if (
            hsv.h >= range.minH && hsv.h <= range.maxH &&
            hsv.s >= range.minS && hsv.s <= range.maxS &&
            hsv.v >= range.minV && hsv.v <= range.maxV
        ) {
            return range.name;
        }
    }
    
    return 'Otro';
}

/**
 * Analyze image data to detect dominant color
 * Takes raw pixel data from canvas
 */
export function analyzeImageColor(
    imageData: Uint8ClampedArray,
    width: number,
    height: number
): ColorResult {
    // Sample pixels from center region (where the car is likely to be)
    const startX = Math.floor(width * 0.2);
    const endX = Math.floor(width * 0.8);
    const startY = Math.floor(height * 0.2);
    const endY = Math.floor(height * 0.8);
    
    const colorCounts: Record<string, { count: number; totalR: number; totalG: number; totalB: number }> = {};
    let totalSamples = 0;
    
    // Sample every 4th pixel for performance
    for (let y = startY; y < endY; y += 4) {
        for (let x = startX; x < endX; x += 4) {
            const idx = (y * width + x) * 4;
            const r = imageData[idx];
            const g = imageData[idx + 1];
            const b = imageData[idx + 2];
            const a = imageData[idx + 3];
            
            // Skip transparent or very dark/light pixels
            if (a < 128) continue;
            
            const color = classifyPixel(r, g, b);
            
            if (!colorCounts[color]) {
                colorCounts[color] = { count: 0, totalR: 0, totalG: 0, totalB: 0 };
            }
            
            colorCounts[color].count++;
            colorCounts[color].totalR += r;
            colorCounts[color].totalG += g;
            colorCounts[color].totalB += b;
            totalSamples++;
        }
    }
    
    // Find dominant color
    let dominantColor = 'Otro';
    let maxCount = 0;
    
    for (const [color, data] of Object.entries(colorCounts)) {
        // Skip 'Otro' for dominance calculation
        if (color === 'Otro') continue;
        if (data.count > maxCount) {
            maxCount = data.count;
            dominantColor = color;
        }
    }
    
    // Calculate average RGB for the dominant color
    const dominantData = colorCounts[dominantColor] || colorCounts['Otro'];
    const avgR = dominantData ? Math.round(dominantData.totalR / dominantData.count) : 128;
    const avgG = dominantData ? Math.round(dominantData.totalG / dominantData.count) : 128;
    const avgB = dominantData ? Math.round(dominantData.totalB / dominantData.count) : 128;
    
    // Calculate confidence based on how dominant the color is
    const confidence = totalSamples > 0 ? maxCount / totalSamples : 0;
    
    return {
        color: dominantColor,
        confidence: Math.round(confidence * 100) / 100,
        rgb: { r: avgR, g: avgG, b: avgB },
    };
}

/**
 * Get color name from hex value
 */
export function getColorFromHex(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    return classifyPixel(r, g, b);
}

/**
 * Get all available colors
 */
export function getAvailableColors(): string[] {
    return [...new Set(COLOR_RANGES.map(r => r.name))];
}
