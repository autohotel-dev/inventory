"""
05_export_models.py
Export trained models to TFLite and CoreML for mobile deployment.

Usage:
    python scripts/05_export_models.py --model training/mobilenet/best_model.pth
    python scripts/05_export_models.py --yolo training/yolo/plate_detection_n/weights/best.pt
"""

import os
import argparse
import torch
import json
import numpy as np
from pathlib import Path
from rich.console import Console
from rich.table import Table

console = Console()


def export_mobilenet_to_tflite(model_path: Path, output_dir: Path):
    """Export PyTorch MobileNet to TFLite."""
    console.print("\n[bold blue]Exporting MobileNet to TFLite[/bold blue]\n")
    
    # Load model
    checkpoint = torch.load(model_path, map_location='cpu')
    num_classes = checkpoint['num_classes']
    class_to_idx = checkpoint['class_to_idx']
    idx_to_class = checkpoint['idx_to_class']
    
    # Recreate model
    from torchvision import models
    import torch.nn as nn
    
    model = models.mobilenet_v3_small(pretrained=False)
    num_features = model.classifier[0].in_features
    model.classifier = nn.Sequential(
        nn.Linear(num_features, 512),
        nn.Hardswish(),
        nn.Dropout(p=0.2),
        nn.Linear(512, 256),
        nn.Hardswish(),
        nn.Dropout(p=0.2),
        nn.Linear(256, num_classes)
    )
    
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()
    
    # Export to ONNX first
    console.print("  Exporting to ONNX...")
    dummy_input = torch.randn(1, 3, 224, 224)
    onnx_path = output_dir / "mobilenet_vehicle.onnx"
    
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=11,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={
            'input': {0: 'batch_size'},
            'output': {0: 'batch_size'}
        }
    )
    console.print(f"  [green]✓[/green] ONNX: {onnx_path}")
    
    # Convert ONNX to TFLite
    try:
        import onnx
        from onnx_tf.backend import prepare
        import tensorflow as tf
        
        console.print("  Converting to TFLite...")
        
        # Load ONNX model
        onnx_model = onnx.load(onnx_path)
        tf_rep = prepare(onnx_model)
        
        # Export to TF SavedModel
        saved_model_dir = output_dir / "saved_model"
        tf_rep.export_graph(saved_model_dir)
        
        # Convert to TFLite
        converter = tf.lite.TFLiteConverter.from_saved_model(str(saved_model_dir))
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        converter.target_spec.supported_types = [tf.float16]
        
        tflite_model = converter.convert()
        
        tflite_path = output_dir / "mobilenet_vehicle.tflite"
        with open(tflite_path, 'wb') as f:
            f.write(tflite_model)
        
        console.print(f"  [green]✓[/green] TFLite: {tflite_path}")
        console.print(f"  Size: {len(tflite_model) / 1024 / 1024:.2f} MB")
        
    except ImportError:
        console.print("  [yellow]⚠[/yellow] TensorFlow not installed. Install with: pip install tensorflow")
        console.print("  ONNX model saved. Convert manually with:")
        console.print("    onnx-tf convert -i mobilenet_vehicle.onnx -o saved_model")
        console.print("    tflite_convert --saved_model_dir=saved_model --output_file=mobilenet_vehicle.tflite")
    
    # Save class labels
    labels_path = output_dir / "vehicle_labels.json"
    labels = {str(k): v for k, v in idx_to_class.items()}
    with open(labels_path, 'w') as f:
        json.dump(labels, f, indent=2, ensure_ascii=False)
    
    console.print(f"  [green]✓[/green] Labels: {labels_path}")
    
    return tflite_path if 'tflite_path' in dir() else None


def export_mobilenet_to_coreml(model_path: Path, output_dir: Path):
    """Export PyTorch MobileNet to CoreML."""
    console.print("\n[bold blue]Exporting MobileNet to CoreML[/bold blue]\n")
    
    try:
        import coremltools as ct
    except ImportError:
        console.print("  [yellow]⚠[/yellow] coremltools not installed. Install with: pip install coremltools")
        return None
    
    # Load model
    checkpoint = torch.load(model_path, map_location='cpu')
    num_classes = checkpoint['num_classes']
    idx_to_class = checkpoint['idx_to_class']
    
    # Recreate model
    from torchvision import models
    import torch.nn as nn
    
    model = models.mobilenet_v3_small(pretrained=False)
    num_features = model.classifier[0].in_features
    model.classifier = nn.Sequential(
        nn.Linear(num_features, 512),
        nn.Hardswish(),
        nn.Dropout(p=0.2),
        nn.Linear(512, 256),
        nn.Hardswish(),
        nn.Dropout(p=0.2),
        nn.Linear(256, num_classes)
    )
    
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()
    
    # Trace model
    console.print("  Tracing model...")
    example_input = torch.randn(1, 3, 224, 224)
    traced_model = torch.jit.trace(model, example_input)
    
    # Convert to CoreML
    console.print("  Converting to CoreML...")
    
    # Create class labels
    class_labels = [idx_to_class[i] for i in range(num_classes)]
    
    mlmodel = ct.convert(
        traced_model,
        inputs=[ct.ImageType(name="input", shape=(1, 3, 224, 224), scale=1/255.0)],
        classifier_config=ct.ClassifierConfig(class_labels),
        minimum_deployment_target=ct.target.iOS15
    )
    
    # Add metadata
    mlmodel.author = "Auto Hotel Luxor"
    mlmodel.short_description = "Vehicle brand/model/color classifier"
    mlmodel.version = "1.0"
    
    # Save
    coreml_path = output_dir / "VehicleClassifier.mlpackage"
    mlmodel.save(coreml_path)
    
    console.print(f"  [green]✓[/green] CoreML: {coreml_path}")
    
    return coreml_path


def export_yolo_to_tflite(yolo_path: Path, output_dir: Path):
    """Export YOLO model to TFLite."""
    console.print("\n[bold blue]Exporting YOLO to TFLite[/bold blue]\n")
    
    try:
        from ultralytics import YOLO
    except ImportError:
        console.print("  [yellow]⚠[/yellow] ultralytics not installed. Install with: pip install ultralytics")
        return None
    
    # Load model
    model = YOLO(yolo_path)
    
    # Export to TFLite
    console.print("  Exporting to TFLite...")
    export_path = model.export(format="tflite", imgsz=640, int8=False)
    
    console.print(f"  [green]✓[/green] TFLite: {export_path}")
    
    # Move to output directory
    tflite_path = output_dir / Path(export_path).name
    if Path(export_path).exists():
        import shutil
        shutil.move(export_path, tflite_path)
        console.print(f"  Moved to: {tflite_path}")
    
    return tflite_path


def main():
    parser = argparse.ArgumentParser(description="Export models for mobile deployment")
    parser.add_argument("--model", type=str, help="PyTorch model path (.pth)")
    parser.add_argument("--yolo", type=str, help="YOLO model path (.pt)")
    parser.add_argument("--output-dir", type=str, default="exported",
                       help="Output directory")
    parser.add_argument("--format", choices=["tflite", "coreml", "all"], default="all",
                       help="Export format")
    
    args = parser.parse_args()
    
    console.print("[bold]Model Export for Mobile[/bold]\n")
    
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if args.model:
        model_path = Path(args.model)
        
        if args.format in ["tflite", "all"]:
            export_mobilenet_to_tflite(model_path, output_dir)
        
        if args.format in ["coreml", "all"]:
            export_mobilenet_to_coreml(model_path, output_dir)
    
    if args.yolo:
        yolo_path = Path(args.yolo)
        export_yolo_to_tflite(yolo_path, output_dir)
    
    console.print("\n[bold green]✓ Export complete![/bold green]")
    console.print(f"\nExported models in: {output_dir.absolute()}")


if __name__ == "__main__":
    main()
