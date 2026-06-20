"""
prepare_mexican_dataset.py
Filter CompCar dataset to only include Mexican market brands.
Creates a clean dataset ready for training.

Usage:
    python scripts/prepare_mexican_dataset.py
"""

import os
import json
import shutil
import scipy.io as sio
from pathlib import Path
from collections import defaultdict
from PIL import Image
from rich.console import Console
from rich.table import Table
from tqdm import tqdm

# Import Mexican brands
from mexican_brands import MEXICAN_MARKET_BRANDS, get_all_brands

console = Console()

# Brand name mapping (CompCar name -> Our name)
BRAND_MAPPING = {
    "Acura": "Acura",
    "Audi": "Audi",
    "BYD": "BYD",
    "Changan Business": "Changan",
    "Dodge": "Dodge",
    "FIAT": "Fiat",
    "Ford": "Ford",
    "GAC": "GAC",
    "GMC": "GMC",
    "Geely": "Geely",
    "Honda": "Honda",
    "Hyundai ": "Hyundai",  # Note the space
    "Infiniti": "Infiniti",
    "Jeep": "Jeep",
    "KIA": "Kia",
    "Lexus": "Lexus",
    "Lincoln": "Lincoln",
    "MG": "MG",
    "MAZDA": "Mazda",
    "Benz": "Mercedes-Benz",
    "MINI": "Mini",
    "Mitsubishi": "Mitsubishi",
    "Nissan": "Nissan",
    "Peugeot": "Peugeot",
    "Renault": "Renault",
    "Seat": "SEAT",
    "Subaru": "Subaru",
    "Suzuki": "Suzuki",
    "TESLA": "Tesla",
    "Toyota": "Toyota",
    "Volkswagen": "Volkswagen",
    "Volvo": "Volvo",
}


def load_compcar_metadata(data_dir: Path):
    """Load CompCar metadata from MATLAB files."""
    console.print("[bold]Loading CompCar metadata...[/bold]")
    
    mat_path = data_dir / "misc" / "make_model_name.mat"
    mat = sio.loadmat(mat_path)
    
    # Extract brand names
    brands = {}
    for idx, make in enumerate(mat['make_names']):
        if len(make) > 0 and len(make[0]) > 0:
            brand_name = make[0][0]
            if isinstance(brand_name, str):
                brands[idx] = brand_name
    
    # Extract model names
    models = {}
    for idx, model in enumerate(mat['model_names']):
        if len(model) > 0 and len(model[0]) > 0:
            model_name = model[0][0]
            if isinstance(model_name, str):
                models[idx] = model_name
    
    console.print(f"  Loaded {len(brands)} brands, {len(models)} models")
    
    return brands, models


def get_brand_images(data_dir: Path, brand_id: int):
    """Get all images for a brand."""
    brand_dir = data_dir / "image" / str(brand_id)
    if not brand_dir.exists():
        return []
    
    images = []
    for model_dir in brand_dir.iterdir():
        if not model_dir.is_dir():
            continue
        
        for year_dir in model_dir.iterdir():
            if not year_dir.is_dir():
                continue
            
            for img_file in year_dir.glob("*.jpg"):
                images.append({
                    "path": img_file,
                    "brand_id": brand_id,
                    "model_id": int(model_dir.name),
                    "year": year_dir.name
                })
    
    return images


def filter_mexican_brands(data_dir: Path, output_dir: Path):
    """Filter dataset to only include Mexican market brands."""
    console.print("\n[bold]Filtering Mexican market brands...[/bold]\n")
    
    # Load metadata
    brands, models = load_compcar_metadata(data_dir)
    
    # Find matching brands
    brand_mapping = {}
    for brand_id, compcar_name in brands.items():
        for compcar_key, our_name in BRAND_MAPPING.items():
            if compcar_name.strip() == compcar_key.strip():
                brand_mapping[brand_id] = {
                    "compcar_name": compcar_name,
                    "our_name": our_name,
                    "brand_id": brand_id
                }
                break
    
    console.print(f"Found {len(brand_mapping)} matching brands")
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Process each brand
    total_images = 0
    brand_stats = []
    
    for brand_id, brand_info in tqdm(brand_mapping.items(), desc="Processing brands"):
        brand_name = brand_info["our_name"]
        compcar_name = brand_info["compcar_name"]
        
        # Get all images for this brand
        images = get_brand_images(data_dir, brand_id)
        
        if not images:
            console.print(f"  [yellow]⚠[/yellow] {brand_name}: No images found")
            continue
        
        # Create brand directory
        brand_output_dir = output_dir / brand_name
        brand_output_dir.mkdir(exist_ok=True)
        
        # Copy images
        copied = 0
        for img_info in images:
            src = img_info["path"]
            dst = brand_output_dir / f"{brand_name}_{copied:05d}.jpg"
            
            try:
                # Copy and resize if needed
                img = Image.open(src)
                img = img.convert('RGB')
                img.save(dst, 'JPEG', quality=95)
                copied += 1
            except Exception as e:
                console.print(f"  [red]Error copying {src}: {e}[/red]")
        
        total_images += copied
        brand_stats.append({
            "brand": brand_name,
            "compcar_name": compcar_name,
            "images": copied
        })
        
        console.print(f"  ✓ {brand_name}: {copied} images")
    
    # Save statistics
    stats = {
        "total_brands": len(brand_stats),
        "total_images": total_images,
        "brands": brand_stats,
        "brand_mapping": BRAND_MAPPING
    }
    
    with open(output_dir / "dataset_stats.json", 'w') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    
    # Display summary
    table = Table(title="Dataset Statistics")
    table.add_column("Brand", style="cyan")
    table.add_column("CompCar Name", style="dim")
    table.add_column("Images", justify="right")
    
    for stat in sorted(brand_stats, key=lambda x: x["images"], reverse=True):
        table.add_row(stat["brand"], stat["compcar_name"], str(stat["images"]))
    
    console.print(table)
    console.print(f"\n[bold green]✓ Dataset prepared![/bold green]")
    console.print(f"  Total: {len(brand_stats)} brands, {total_images} images")
    console.print(f"  Location: {output_dir}")
    
    return stats


def split_dataset(data_dir: Path, train_ratio=0.7, val_ratio=0.15, test_ratio=0.15):
    """Split dataset into train/val/test."""
    console.print("\n[bold]Splitting dataset...[/bold]\n")
    
    import random
    random.seed(42)
    
    # Get all brand directories
    brand_dirs = [d for d in data_dir.iterdir() if d.is_dir() and d.name != "__pycache__"]
    
    # Create split directories
    for split in ["train", "val", "test"]:
        (data_dir / split).mkdir(exist_ok=True)
    
    # Split each brand
    for brand_dir in tqdm(brand_dirs, desc="Splitting"):
        brand_name = brand_dir.name
        
        # Get all images
        images = list(brand_dir.glob("*.jpg"))
        random.shuffle(images)
        
        # Calculate split indices
        n = len(images)
        train_end = int(n * train_ratio)
        val_end = int(n * (train_ratio + val_ratio))
        
        # Copy images to splits
        for i, img in enumerate(images):
            if i < train_end:
                split = "train"
            elif i < val_end:
                split = "val"
            else:
                split = "test"
            
            dst = data_dir / split / brand_name / img.name
            dst.parent.mkdir(exist_ok=True)
            shutil.copy2(img, dst)
        
        # Remove original brand directory
        # shutil.rmtree(brand_dir)  # Uncomment to clean up
    
    # Count images per split
    for split in ["train", "val", "test"]:
        split_dir = data_dir / split
        count = sum(1 for _ in split_dir.rglob("*.jpg"))
        console.print(f"  {split}: {count} images")


def main():
    console.print("[bold]Mexican Market Dataset Preparation[/bold]\n")
    
    # Paths
    compcar_dir = Path("datasets/compcar/extracted/data")
    output_dir = Path("datasets/mexican_market")
    
    if not compcar_dir.exists():
        console.print(f"[red]Error: CompCar dataset not found at {compcar_dir}[/red]")
        console.print("Please download and extract the dataset first.")
        return
    
    # Filter Mexican brands
    stats = filter_mexican_brands(compcar_dir, output_dir)
    
    # Split dataset
    split_dataset(output_dir)
    
    console.print("\n[bold green]✓ Dataset ready for training![/bold green]")
    console.print(f"\nNext step: python scripts/train_mexican_market.py --data-dir datasets/mexican_market")


if __name__ == "__main__":
    main()
