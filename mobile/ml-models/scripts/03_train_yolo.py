"""
03_train_yolo.py
Train YOLOv8 for vehicle and license plate detection.

Usage:
    python scripts/03_train_yolo.py --epochs 100 --batch-size 16
    python scripts/03_train_yolo.py --pretrained --epochs 50
"""

import os
import argparse
import yaml
from pathlib import Path
from ultralytics import YOLO
from rich.console import Console
from rich.table import Table

console = Console()

# YOLO class definitions
CLASSES = {
    0: "vehicle",
    1: "license_plate",
}

# Dataset configuration
DATASET_CONFIG = {
    "path": str(Path("datasets/yolo_plate").absolute()),
    "train": "train/images",
    "val": "val/images",
    "test": "test/images",
    "names": CLASSES,
    "nc": len(CLASSES)
}


def create_dataset_structure(data_dir: Path):
    """Create YOLO dataset directory structure."""
    console.print("[bold]Creating YOLO dataset structure...[/bold]")
    
    for split in ["train", "val", "test"]:
        (data_dir / split / "images").mkdir(parents=True, exist_ok=True)
        (data_dir / split / "labels").mkdir(parents=True, exist_ok=True)
    
    console.print(f"  Created in: {data_dir}")


def create_dataset_yaml(data_dir: Path, output_path: Path):
    """Create dataset YAML configuration."""
    config = {
        "path": str(data_dir.absolute()),
        "train": "train/images",
        "val": "val/images",
        "test": "test/images",
        "names": CLASSES,
        "nc": len(CLASSES)
    }
    
    with open(output_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)
    
    console.print(f"  Dataset config: {output_path}")


def train_yolo(
    data_yaml: Path,
    model_size: str = "n",
    epochs: int = 100,
    batch_size: int = 16,
    img_size: int = 640,
    pretrained: bool = True,
    device: str = "auto"
):
    """Train YOLO model."""
    console.print("\n[bold blue]Training YOLO Model[/bold blue]\n")
    
    # Load model
    if pretrained:
        model = YOLO(f"yolov8{model_size}.pt")
        console.print(f"  Loaded pretrained: yolov8{model_size}.pt")
    else:
        model = YOLO(f"yolov8{model_size}.yaml")
        console.print(f"  Created new model: yolov8{model_size}.yaml")
    
    # Training parameters
    train_args = {
        "data": str(data_yaml),
        "epochs": epochs,
        "batch": batch_size,
        "imgsz": img_size,
        "device": device,
        "project": "training/yolo",
        "name": f"plate_detection_{model_size}",
        "exist_ok": True,
        "patience": 20,
        "save": True,
        "save_period": 10,
        "plots": True,
        "verbose": True,
    }
    
    # Display training config
    table = Table(title="Training Configuration")
    table.add_column("Parameter", style="cyan")
    table.add_column("Value", style="green")
    
    for key, value in train_args.items():
        table.add_row(key, str(value))
    
    console.print(table)
    
    # Train
    console.print("\n[bold]Starting training...[/bold]")
    results = model.train(**train_args)
    
    console.print("\n[bold green]✓ Training complete![/bold green]")
    console.print(f"  Best model: training/yolo/{train_args['name']}/weights/best.pt")
    
    return model, results


def validate_model(model_path: Path, data_yaml: Path):
    """Validate trained model."""
    console.print("\n[bold blue]Validating Model[/bold blue]\n")
    
    model = YOLO(model_path)
    results = model.val(data=str(data_yaml))
    
    # Display results
    table = Table(title="Validation Results")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")
    
    table.add_row("mAP50", f"{results.box.map50:.4f}")
    table.add_row("mAP50-95", f"{results.box.map:.4f}")
    table.add_row("Precision", f"{results.box.mp:.4f}")
    table.add_row("Recall", f"{results.box.mr:.4f}")
    
    console.print(table)
    
    return results


def export_model(model_path: Path, formats: list = ["onnx", "tflite"]):
    """Export model to different formats."""
    console.print("\n[bold blue]Exporting Model[/bold blue]\n")
    
    model = YOLO(model_path)
    
    for fmt in formats:
        try:
            console.print(f"  Exporting to {fmt}...")
            export_path = model.export(format=fmt)
            console.print(f"  [green]✓[/green] {fmt}: {export_path}")
        except Exception as e:
            console.print(f"  [red]✗[/red] {fmt}: {e}")


def main():
    parser = argparse.ArgumentParser(description="Train YOLO for plate detection")
    parser.add_argument("--data-dir", type=str, default="datasets/yolo_plate",
                       help="YOLO dataset directory")
    parser.add_argument("--model-size", choices=["n", "s", "m", "l", "x"], 
                       default="n", help="YOLO model size")
    parser.add_argument("--epochs", type=int, default=100, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size")
    parser.add_argument("--img-size", type=int, default=640, help="Image size")
    parser.add_argument("--pretrained", action="store_true", default=True,
                       help="Use pretrained weights")
    parser.add_argument("--device", type=str, default="auto", help="Device (cpu/0/auto)")
    parser.add_argument("--validate", type=str, help="Validate model path")
    parser.add_argument("--export", type=str, help="Export model path")
    
    args = parser.parse_args()
    
    console.print("[bold]YOLO License Plate Detection Training[/bold]\n")
    
    data_dir = Path(args.data_dir)
    data_yaml = data_dir / "dataset.yaml"
    
    if args.validate:
        # Validate existing model
        model_path = Path(args.validate)
        validate_model(model_path, data_yaml)
    elif args.export:
        # Export existing model
        model_path = Path(args.export)
        export_model(model_path)
    else:
        # Train new model
        create_dataset_structure(data_dir)
        create_dataset_yaml(data_dir, data_yaml)
        
        model, results = train_yolo(
            data_yaml=data_yaml,
            model_size=args.model_size,
            epochs=args.epochs,
            batch_size=args.batch_size,
            img_size=args.img_size,
            pretrained=args.pretrained,
            device=args.device
        )
        
        # Auto-export best model
        best_model = Path(f"training/yolo/plate_detection_{args.model_size}/weights/best.pt")
        if best_model.exists():
            export_model(best_model, formats=["onnx", "tflite"])


if __name__ == "__main__":
    main()
