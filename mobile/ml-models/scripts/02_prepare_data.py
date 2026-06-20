"""
02_prepare_data.py
Prepare datasets for training: split, normalize, create data loaders.

Usage:
    python scripts/02_prepare_data.py --dataset compcar
    python scripts/02_prepare_data.py --dataset stanford
"""

import os
import json
import argparse
import shutil
import random
from pathlib import Path
from collections import defaultdict
from PIL import Image
import pandas as pd
from sklearn.model_selection import train_test_split
from rich.console import Console
from rich.table import Table
from tqdm import tqdm

console = Console()

# Mexican market brands (priority)
MEXICAN_MARKET_BRANDS = [
    "Nissan", "Toyota", "Volkswagen", "Chevrolet", "Ford",
    "Honda", "Hyundai", "Kia", "Mazda", "BMW",
    "Mercedes-Benz", "Audi", "Jeep", "Subaru", "Mitsubishi",
    "Suzuki", "Renault", "Peugeot", "SEAT", "Fiat",
    "BYD", "MG", "Chery", "Changan", "JAC",
    "Tesla", "Volvo", "Land Rover", "Mini", "Smart"
]

# Mexican license plate patterns
PLATE_PATTERNS = {
    "standard": r"^[A-Z]{3}-\d{3}$",
    "new": r"^[A-Z]{3}-\d{2}-\d{2}$",
    "classic": r"^\d{3}-[A-Z]{3}$",
    "diplomatic": r"^[A-Z]{2}-\d{4}$",
}

# Color mapping
COLOR_MAP = {
    "white": "Blanco",
    "black": "Negro",
    "silver": "Plata",
    "gray": "Gris",
    "red": "Rojo",
    "blue": "Azul",
    "green": "Verde",
    "yellow": "Amarillo",
    "orange": "Naranja",
    "brown": "Café",
    "beige": "Beige",
    "other": "Otro"
}


class CompCarPreparer:
    """Prepare CompCar dataset for training."""
    
    def __init__(self, data_dir: Path, output_dir: Path):
        self.data_dir = data_dir / "compcar"
        self.output_dir = output_dir / "compcar"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def load_metadata(self):
        """Load CompCar metadata files."""
        console.print("[bold]Loading CompCar metadata...[/bold]")
        
        # Load brand names
        brand_file = self.data_dir / "misc" / "make_names.txt"
        if brand_file.exists():
            with open(brand_file, 'r') as f:
                self.brands = [line.strip() for line in f.readlines()]
            console.print(f"  Loaded {len(self.brands)} brands")
        else:
            console.print("[yellow]Warning: make_names.txt not found, using default brands[/yellow]")
            self.brands = MEXICAN_MARKET_BRANDS
        
        # Load model names
        model_file = self.data_dir / "misc" / "model_names.txt"
        if model_file.exists():
            with open(model_file, 'r') as f:
                self.models = [line.strip() for line in f.readlines()]
            console.print(f"  Loaded {len(self.models)} models")
        else:
            self.models = []
        
        # Load image paths and labels
        self.image_paths = []
        self.labels = []
        
        # Parse directory structure: image/{brand_id}/{model_id}/{year}/{image_id}.jpg
        image_dir = self.data_dir / "image"
        if image_dir.exists():
            for brand_dir in tqdm(list(image_dir.iterdir()), desc="Scanning brands"):
                if not brand_dir.is_dir():
                    continue
                brand_id = brand_dir.name
                
                for model_dir in brand_dir.iterdir():
                    if not model_dir.is_dir():
                        continue
                    model_id = model_dir.name
                    
                    for year_dir in model_dir.iterdir():
                        if not year_dir.is_dir():
                            continue
                        
                        for img_file in year_dir.glob("*.jpg"):
                            self.image_paths.append(img_file)
                            self.labels.append({
                                "brand_id": brand_id,
                                "model_id": model_id,
                                "year": year_dir.name,
                                "brand_name": self.brands[int(brand_id)] if int(brand_id) < len(self.brands) else "Unknown",
                                "model_name": self.models[int(model_id)] if int(model_id) < len(self.models) else "Unknown",
                            })
        
        console.print(f"  Total images: {len(self.image_paths)}")
        return self
    
    def filter_mexican_market(self):
        """Filter to prioritize Mexican market brands."""
        console.print("\n[bold]Filtering for Mexican market...[/bold]")
        
        filtered_paths = []
        filtered_labels = []
        
        for path, label in zip(self.image_paths, self.labels):
            if label["brand_name"] in MEXICAN_MARKET_BRANDS:
                filtered_paths.append(path)
                filtered_labels.append(label)
        
        console.print(f"  Mexican market images: {len(filtered_paths)}")
        console.print(f"  Other brands: {len(self.image_paths) - len(filtered_paths)}")
        
        # Keep all for training, but mark priority
        self.image_paths = self.image_paths
        self.labels = self.labels
        self.priority_indices = set(range(len(filtered_paths)))
        
        return self
    
    def split_dataset(self, train_ratio=0.7, val_ratio=0.15, test_ratio=0.15):
        """Split dataset into train/val/test."""
        console.print("\n[bold]Splitting dataset...[/bold]")
        
        indices = list(range(len(self.image_paths)))
        
        # First split: train+val vs test
        train_val_idx, test_idx = train_test_split(
            indices, test_size=test_ratio, random_state=42, stratify=[l["brand_id"] for l in self.labels]
        )
        
        # Second split: train vs val
        val_size = val_ratio / (train_ratio + val_ratio)
        train_idx, val_idx = train_test_split(
            train_val_idx, test_size=val_size, random_state=42, stratify=[self.labels[i]["brand_id"] for i in train_val_idx]
        )
        
        self.splits = {
            "train": train_idx,
            "val": val_idx,
            "test": test_idx
        }
        
        table = Table(title="Dataset Split")
        table.add_column("Split", style="cyan")
        table.add_column("Images", justify="right")
        table.add_column("Percentage", justify="right")
        
        for split, idx in self.splits.items():
            pct = len(idx) / len(indices) * 100
            table.add_row(split, str(len(idx)), f"{pct:.1f}%")
        
        console.print(table)
        return self
    
    def create_structure(self):
        """Create YOLO-compatible directory structure."""
        console.print("\n[bold]Creating directory structure...[/bold]")
        
        for split_name, indices in self.splits.items():
            split_dir = self.output_dir / split_name
            split_dir.mkdir(exist_ok=True)
            
            # Create subdirectories for each class
            brand_dirs = set()
            for idx in indices:
                label = self.labels[idx]
                brand_dir = split_dir / label["brand_name"]
                brand_dir.mkdir(exist_ok=True)
                brand_dirs.add(label["brand_name"])
            
            console.print(f"  {split_name}: {len(indices)} images, {len(brand_dirs)} brands")
        
        return self
    
    def copy_images(self):
        """Copy images to structured directories."""
        console.print("\n[bold]Copying images...[/bold]")
        
        for split_name, indices in self.splits.items():
            split_dir = self.output_dir / split_name
            
            for idx in tqdm(indices, desc=f"Copying {split_name}"):
                src = self.image_paths[idx]
                label = self.labels[idx]
                
                dst = split_dir / label["brand_name"] / f"{idx:06d}.jpg"
                
                try:
                    shutil.copy2(src, dst)
                except Exception as e:
                    console.print(f"[red]Error copying {src}: {e}[/red]")
        
        return self
    
    def save_metadata(self):
        """Save dataset metadata."""
        console.print("\n[bold]Saving metadata...[/bold]")
        
        metadata = {
            "brands": self.brands,
            "models": self.models,
            "mexican_brands": MEXICAN_MARKET_BRANDS,
            "color_map": COLOR_MAP,
            "plate_patterns": PLATE_PATTERNS,
            "splits": {k: len(v) for k, v in self.splits.items()},
            "total_images": len(self.image_paths)
        }
        
        with open(self.output_dir / "metadata.json", 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Save labels
        labels_df = pd.DataFrame(self.labels)
        labels_df.to_csv(self.output_dir / "labels.csv", index=False)
        
        console.print(f"  Saved: {self.output_dir / 'metadata.json'}")
        console.print(f"  Saved: {self.output_dir / 'labels.csv'}")
        
        return self


class StanfordPreparer:
    """Prepare Stanford Cars dataset for training."""
    
    def __init__(self, data_dir: Path, output_dir: Path):
        self.data_dir = data_dir / "stanford_cars"
        self.output_dir = output_dir / "stanford_cars"
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def prepare(self):
        """Prepare Stanford dataset."""
        console.print("[bold]Preparing Stanford Cars Dataset...[/bold]")
        
        # Stanford dataset is simpler, just organize by class
        # Implementation depends on actual file structure after download
        
        console.print("[yellow]Note: Stanford preparation requires downloaded dataset.[/yellow]")
        console.print("Run 01_download_datasets.py first.")
        
        return self


def main():
    parser = argparse.ArgumentParser(description="Prepare datasets for training")
    parser.add_argument("--dataset", choices=["compcar", "stanford", "all"], 
                       default="compcar", help="Dataset to prepare")
    parser.add_argument("--data-dir", type=str, default="datasets",
                       help="Raw dataset directory")
    parser.add_argument("--output-dir", type=str, default="datasets/prepared",
                       help="Output directory")
    
    args = parser.parse_args()
    
    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    console.print("[bold]Dataset Preparation[/bold]\n")
    
    if args.dataset in ["compcar", "all"]:
        preparer = CompCarPreparer(data_dir, output_dir)
        preparer.load_metadata()
        preparer.filter_mexican_market()
        preparer.split_dataset()
        preparer.create_structure()
        preparer.copy_images()
        preparer.save_metadata()
    
    if args.dataset in ["stanford", "all"]:
        preparer = StanfordPreparer(data_dir, output_dir)
        preparer.prepare()
    
    console.print("\n[bold green]✓ Dataset preparation complete![/bold green]")


if __name__ == "__main__":
    main()
