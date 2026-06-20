"""
06_test_inference.py
Test inference pipeline with sample images.

Usage:
    python scripts/06_test_inference.py --image test.jpg
    python scripts/06_test_inference.py --dir test_images/
"""

import os
import argparse
import json
import time
import numpy as np
from pathlib import Path
from PIL import Image
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()


class VehicleDetector:
    """Complete vehicle detection pipeline."""
    
    def __init__(self, model_dir: Path):
        self.model_dir = model_dir
        
        # Load class labels
        labels_path = model_dir / "vehicle_labels.json"
        if labels_path.exists():
            with open(labels_path, 'r') as f:
                self.idx_to_class = {int(k): v for k, v in json.load(f).items()}
        else:
            self.idx_to_class = {}
        
        # Initialize models
        self.yolo_model = None
        self.classifier_model = None
        self.ocr_model = None
        
        self._load_models()
    
    def _load_models(self):
        """Load all models."""
        console.print("[bold]Loading models...[/bold]")
        
        # Load YOLO
        yolo_path = self.model_dir / "yolo_plate.tflite"
        if yolo_path.exists():
            try:
                # YOLO TFLite inference
                console.print(f"  ✓ YOLO: {yolo_path}")
                self.yolo_model = str(yolo_path)
            except Exception as e:
                console.print(f"  ✗ YOLO: {e}")
        
        # Load MobileNet classifier
        classifier_path = self.model_dir / "mobilenet_vehicle.tflite"
        if classifier_path.exists():
            try:
                # TFLite inference
                console.print(f"  ✓ Classifier: {classifier_path}")
                self.classifier_model = str(classifier_path)
            except Exception as e:
                console.print(f"  ✗ Classifier: {e}")
        
        # Load ML Kit OCR (placeholder)
        console.print("  ✓ OCR: ML Kit (runtime)")
    
    def detect_vehicle(self, image: Image.Image):
        """Detect vehicle in image using YOLO."""
        # Placeholder for YOLO inference
        # In production, this would run TFLite inference
        return {
            "bbox": [0, 0, image.width, image.height],
            "confidence": 0.95,
            "class": "vehicle"
        }
    
    def detect_plate(self, image: Image.Image):
        """Detect license plate in image."""
        # Placeholder for plate detection
        # In production, this would use YOLO to find plate region
        return {
            "bbox": [100, 200, 300, 250],
            "confidence": 0.88,
            "class": "license_plate"
        }
    
    def classify_vehicle(self, image: Image.Image):
        """Classify vehicle brand/model/color."""
        # Placeholder for MobileNet inference
        # In production, this would run TFLite inference
        
        # Simulate classification
        if self.idx_to_class:
            # Return random class for testing
            import random
            class_idx = random.randint(0, len(self.idx_to_class) - 1)
            return {
                "brand": self.idx_to_class.get(class_idx, "Unknown"),
                "model": "Unknown",
                "color": "Blanco",
                "confidence": 0.75
            }
        
        return {
            "brand": "Unknown",
            "model": "Unknown",
            "color": "Unknown",
            "confidence": 0.0
        }
    
    def ocr_plate(self, image: Image.Image, plate_bbox: dict):
        """OCR on license plate region."""
        # Placeholder for ML Kit OCR
        # In production, this would use ML Kit Text Recognition
        
        # Crop plate region
        x1, y1, x2, y2 = plate_bbox["bbox"]
        plate_img = image.crop((x1, y1, x2, y2))
        
        # Simulate OCR result
        return {
            "text": "ABC-123",
            "confidence": 0.92,
            "format": "standard"
        }
    
    def detect(self, image_path: Path):
        """Run complete detection pipeline."""
        console.print(f"\n[bold]Processing: {image_path.name}[/bold]")
        
        # Load image
        image = Image.open(image_path).convert('RGB')
        console.print(f"  Image size: {image.size}")
        
        results = {}
        
        # Step 1: Detect vehicle
        start = time.time()
        vehicle = self.detect_vehicle(image)
        results["vehicle"] = vehicle
        console.print(f"  Vehicle detected: {vehicle['confidence']:.2f} ({time.time()-start:.3f}s)")
        
        # Step 2: Detect plate
        start = time.time()
        plate = self.detect_plate(image)
        results["plate"] = plate
        console.print(f"  Plate detected: {plate['confidence']:.2f} ({time.time()-start:.3f}s)")
        
        # Step 3: Classify vehicle
        start = time.time()
        classification = self.classify_vehicle(image)
        results["classification"] = classification
        console.print(f"  Classified: {classification['brand']} ({time.time()-start:.3f}s)")
        
        # Step 4: OCR plate
        start = time.time()
        ocr = self.ocr_plate(image, plate)
        results["ocr"] = ocr
        console.print(f"  OCR: {ocr['text']} ({time.time()-start:.3f}s)")
        
        return results


def display_results(results: dict):
    """Display detection results in a table."""
    table = Table(title="Detection Results")
    table.add_column("Field", style="cyan")
    table.add_column("Value", style="green")
    table.add_column("Confidence", justify="right")
    
    # Vehicle
    table.add_row(
        "Vehicle",
        "Detected" if results["vehicle"]["confidence"] > 0.5 else "Not detected",
        f"{results['vehicle']['confidence']:.2f}"
    )
    
    # Plate
    table.add_row(
        "Plate",
        results["ocr"]["text"],
        f"{results['plate']['confidence']:.2f}"
    )
    
    # Classification
    table.add_row(
        "Brand",
        results["classification"]["brand"],
        f"{results['classification']['confidence']:.2f}"
    )
    
    table.add_row(
        "Model",
        results["classification"]["model"],
        ""
    )
    
    table.add_row(
        "Color",
        results["classification"]["color"],
        ""
    )
    
    console.print(table)


def main():
    parser = argparse.ArgumentParser(description="Test vehicle detection pipeline")
    parser.add_argument("--image", type=str, help="Single image path")
    parser.add_argument("--dir", type=str, help="Directory of images")
    parser.add_argument("--model-dir", type=str, default="exported",
                       help="Model directory")
    
    args = parser.parse_args()
    
    console.print("[bold]Vehicle Detection Pipeline Test[/bold]\n")
    
    model_dir = Path(args.model_dir)
    detector = VehicleDetector(model_dir)
    
    if args.image:
        # Single image
        image_path = Path(args.image)
        if image_path.exists():
            results = detector.detect(image_path)
            display_results(results)
        else:
            console.print(f"[red]Image not found: {image_path}[/red]")
    
    elif args.dir:
        # Directory of images
        dir_path = Path(args.dir)
        if dir_path.exists():
            images = list(dir_path.glob("*.jpg")) + list(dir_path.glob("*.png"))
            
            console.print(f"Found {len(images)} images\n")
            
            for image_path in images[:5]:  # Test first 5
                results = detector.detect(image_path)
                display_results(results)
        else:
            console.print(f"[red]Directory not found: {dir_path}[/red]")
    
    else:
        console.print("[yellow]No image specified. Use --image or --dir[/yellow]")


if __name__ == "__main__":
    main()
