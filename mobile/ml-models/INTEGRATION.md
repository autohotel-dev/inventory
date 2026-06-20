# ML Models Integration Guide

## Overview

This module provides local, on-device vehicle detection for the Auto Hotel Luxor mobile app.

**Capabilities:**
- 🚗 Vehicle detection in images
- 📝 License plate detection and OCR
- 🏷️ Brand/model classification
- 🎨 Color detection

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (Expo)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📸 Camera Input                                            │
│      │                                                      │
│      ▼                                                      │
│  ┌─────────────────────────────────────────┐                │
│  │  ml-detection.ts                        │                │
│  │  ├─ detectVehicle()                     │                │
│  │  ├─ formatMexicanPlate()                │                │
│  │  └─ isValidMexicanPlate()               │                │
│  └─────────────────────────────────────────┘                │
│      │                                                      │
│      ├─► YOLOv8-nano (TFLite)      → Bounding boxes         │
│      ├─► MobileNetV3 (TFLite)      → Brand/Model/Color      │
│      └─► ML Kit (Native)           → Plate OCR              │
│                                                             │
│  📤 Output                                                  │
│  {                                                          │
│    plate: { text: "ABC-123", confidence: 0.92 },            │
│    vehicle: {                                               │
│      brand: "Toyota",                                       │
│      model: "Corolla",                                      │
│      color: "Blanco",                                       │
│      confidence: 0.85                                       │
│    },                                                       │
│    processingTime: 150  // ms                               │
│  }                                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Model Files

| File | Size | Purpose |
|------|------|---------|
| `yolo_plate.tflite` | ~6MB | Vehicle + plate detection |
| `mobilenet_vehicle.tflite` | ~15MB | Brand/model/color classification |
| `vehicle_labels.json` | ~50KB | Class label mappings |

**Total: ~21MB**

## Setup

### 1. Train Models

```bash
cd ml-models

# Install dependencies
pip install -r requirements.txt

# Download datasets
python scripts/01_download_datasets.py --dataset compcar

# Prepare data
python scripts/02_prepare_data.py --dataset compcar

# Train YOLO for plate detection
python scripts/03_train_yolo.py --epochs 100

# Train MobileNet for classification
python scripts/04_train_mobilenet.py --epochs 50

# Export to TFLite
python scripts/05_export_models.py --model training/mobilenet/best_model.pth
```

### 2. Deploy Models

Copy exported models to app:
```bash
cp exported/*.tflite ../assets/models/
cp exported/vehicle_labels.json ../assets/models/
```

### 3. Bundle with App

Add to `app.json`:
```json
{
  "expo": {
    "assets": [
      "./assets/models/*.tflite",
      "./assets/models/*.json"
    ]
  }
}
```

## Usage in App

```typescript
import { detectVehicle, checkModelStatus } from '../lib/ml-detection';

// Check if models are ready
const status = await checkModelStatus();
if (!status.ready) {
  // Download or bundle models
}

// Detect vehicle
const result = await detectVehicle(imageUri, {
  detectPlate: true,
  classifyVehicle: true,
  ocrPlate: true
});

console.log(result.plate.text);      // "ABC-123"
console.log(result.vehicle.brand);   // "Toyota"
console.log(result.vehicle.color);   // "Blanco"
```

## Datasets

| Dataset | Images | Classes | Source |
|---------|--------|---------|--------|
| CompCar | 136K+ | 431 brands, 4818 models | CUHK |
| Stanford Cars | 16K | 196 classes | Stanford |
| BIT-Vehicle | 9.8K | Detection | BIT |

## Performance Targets

| Metric | Target |
|--------|--------|
| Inference time | < 200ms |
| Plate accuracy | > 95% |
| Brand accuracy | > 85% |
| Color accuracy | > 90% |

## TODO

- [ ] Download and prepare CompCar dataset
- [ ] Train YOLO for Mexican plates
- [ ] Train MobileNet for brand/model classification
- [ ] Export to TFLite
- [ ] Implement TFLite inference in React Native
- [ ] Add ML Kit integration
- [ ] Test with real vehicle images
- [ ] Optimize for mobile performance
