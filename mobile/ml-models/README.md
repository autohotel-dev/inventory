# Vehicle Detection ML Pipeline
# Auto Hotel Luxor - Plate, Brand, Model, Color Detection

## Pipeline Architecture

```
Input Image (640x640)
       │
       ▼
┌──────────────────┐
│  YOLOv8-nano     │  ← Detect vehicle + plate
│  (~6MB)          │
└──────────────────┘
       │
       ├─► Vehicle crop (224x224)
       └─► Plate crop (320x80)
              │
              ▼
┌──────────────────┐     ┌──────────────────┐
│  MobileNetV3     │     │  ML Kit OCR      │
│  Classification  │     │  Text Recognition│
│  (~15MB)         │     │  (~3MB)          │
└──────────────────┘     └──────────────────┘
       │                         │
       ▼                         ▼
  Brand/Model/Color         Plate Number
```

## Datasets

1. **CompCar** - Main dataset for brand/model classification
   - 136K+ images, 431 brands, 4,818 models
   - Download: http://mmlab.ie.cuhk.edu.hk/datasets/comp_cars/index.html

2. **Stanford Cars** - Backup/simpler dataset
   - 16K images, 196 classes
   - HuggingFace: `tanganke/stanford_cars`

3. **BIT-Vehicle** - Vehicle detection
   - 9.8K images
   - For YOLO training

## Training Order

1. Download datasets (`scripts/01_download_datasets.py`)
2. Prepare data (`scripts/02_prepare_data.py`)
3. Train YOLO for plate detection (`scripts/03_train_yolo.py`)
4. Train MobileNet for classification (`scripts/04_train_mobilenet.py`)
5. Export to TFLite/CoreML (`scripts/05_export_models.py`)
6. Test inference (`scripts/06_test_inference.py`)
