"""
01_download_datasets.py
Download and extract datasets for vehicle detection training.

Usage:
    python scripts/01_download_datasets.py --dataset all
    python scripts/01_download_datasets.py --dataset compcar
    python scripts/01_download_datasets.py --dataset stanford
"""

import os
import argparse
import zipfile
import tarfile
import requests
from pathlib import Path
from tqdm import tqdm
from rich.console import Console

console = Console()

# Dataset URLs
DATASETS = {
    "compcar": {
        "name": "CompCar Dataset",
        "urls": {
            "images": "http://mmlab.ie.cuhk.edu.hk/datasets/comp_cars/image.zip",
            "labels": "http://mmlab.ie.cuhk.edu.hk/datasets/comp_cars/label.zip",
            "split": "http://mmlab.ie.cuhk.edu.hk/datasets/comp_cars/train_test.zip",
        },
        "description": "136K+ images, 431 brands, 4,818 models"
    },
    "stanford": {
        "name": "Stanford Cars Dataset",
        "urls": {
            "train": "http://ai.stanford.edu/~jkrause/car196/car_ims.tgz",
            "labels": "http://ai.stanford.edu/~jkrause/car196/annotations.tar",
        },
        "description": "16K images, 196 classes"
    },
    "bit_vehicle": {
        "name": "BIT-Vehicle Dataset",
        "urls": {
            "images": "https://github.com/yaringal/BiT-vehicle-dataset/raw/master/BiT-vehicle-dataset.zip",
        },
        "description": "9.8K vehicle images"
    }
}


def download_file(url: str, dest_path: Path, desc: str = ""):
    """Download a file with progress bar."""
    try:
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        
        with open(dest_path, 'wb') as f:
            with tqdm(total=total_size, unit='B', unit_scale=True, desc=desc) as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    pbar.update(len(chunk))
        
        console.print(f"  [green]✓[/green] Downloaded: {dest_path.name}")
        return True
    except Exception as e:
        console.print(f"  [red]✗[/red] Failed: {e}")
        return False


def extract_archive(archive_path: Path, dest_dir: Path):
    """Extract zip or tar archive."""
    console.print(f"  Extracting: {archive_path.name}...")
    
    if archive_path.suffix == '.zip':
        with zipfile.ZipFile(archive_path, 'r') as zip_ref:
            zip_ref.extractall(dest_dir)
    elif archive_path.suffix in ['.tgz', '.tar', '.gz']:
        with tarfile.open(archive_path, 'r:*') as tar_ref:
            tar_ref.extractall(dest_dir)
    else:
        console.print(f"  [yellow]⚠[/yellow] Unknown archive format: {archive_path.suffix}")
        return
    
    console.print(f"  [green]✓[/green] Extracted to: {dest_dir}")


def download_compcar(base_dir: Path):
    """Download CompCar dataset."""
    console.print("\n[bold blue]Downloading CompCar Dataset[/bold blue]")
    console.print("This is the main dataset for brand/model classification.\n")
    
    compcar_dir = base_dir / "compcar"
    compcar_dir.mkdir(exist_ok=True)
    
    for name, url in DATASETS["compcar"]["urls"].items():
        dest = compcar_dir / f"{name}.zip"
        if dest.exists():
            console.print(f"  [yellow]⚠[/yellow] Already exists: {dest.name}")
            continue
        
        if download_file(url, dest, desc=f"CompCar {name}"):
            extract_archive(dest, compcar_dir)


def download_stanford(base_dir: Path):
    """Download Stanford Cars dataset."""
    console.print("\n[bold blue]Downloading Stanford Cars Dataset[/bold blue]")
    console.print("Simpler dataset for initial training.\n")
    
    stanford_dir = base_dir / "stanford_cars"
    stanford_dir.mkdir(exist_ok=True)
    
    for name, url in DATASETS["stanford"]["urls"].items():
        ext = ".tgz" if "tgz" in url else ".tar"
        dest = stanford_dir / f"{name}{ext}"
        if dest.exists():
            console.print(f"  [yellow]⚠[/yellow] Already exists: {dest.name}")
            continue
        
        if download_file(url, dest, desc=f"Stanford {name}"):
            extract_archive(dest, stanford_dir)


def download_bit_vehicle(base_dir: Path):
    """Download BIT-Vehicle dataset."""
    console.print("\n[bold blue]Downloading BIT-Vehicle Dataset[/bold blue]")
    console.print("Vehicle detection dataset.\n")
    
    bit_dir = base_dir / "bit_vehicle"
    bit_dir.mkdir(exist_ok=True)
    
    dest = bit_dir / "bit_vehicle.zip"
    if dest.exists():
        console.print(f"  [yellow]⚠[/yellow] Already exists: {dest.name}")
        return
    
    url = list(DATASETS["bit_vehicle"]["urls"].values())[0]
    if download_file(url, dest, desc="BIT-Vehicle"):
        extract_archive(dest, bit_dir)


def main():
    parser = argparse.ArgumentParser(description="Download vehicle detection datasets")
    parser.add_argument("--dataset", choices=["all", "compcar", "stanford", "bit_vehicle"], 
                       default="all", help="Dataset to download")
    parser.add_argument("--data-dir", type=str, default="datasets",
                       help="Directory to store datasets")
    
    args = parser.parse_args()
    
    base_dir = Path(args.data_dir)
    base_dir.mkdir(exist_ok=True)
    
    console.print("[bold]Vehicle Detection Dataset Downloader[/bold]\n")
    
    if args.dataset in ["all", "compcar"]:
        download_compcar(base_dir)
    
    if args.dataset in ["all", "stanford"]:
        download_stanford(base_dir)
    
    if args.dataset in ["all", "bit_vehicle"]:
        download_bit_vehicle(base_dir)
    
    console.print("\n[bold green]✓ Dataset download complete![/bold green]")
    console.print(f"\nDatasets stored in: {base_dir.absolute()}")


if __name__ == "__main__":
    main()
