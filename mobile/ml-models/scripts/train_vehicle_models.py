"""
train_vehicle_models.py
Train MobileNetV3 for vehicle MODEL classification (e.g., Corolla, Camry, Civic)
For Mexican market brands.

Usage:
    python scripts/train_vehicle_models.py --epochs 30 --batch-size 32
"""

import os
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms, models
from pathlib import Path
from PIL import Image
from tqdm import tqdm
import scipy.io as sio
from rich.console import Console
from rich.table import Table

console = Console()

# Mexican market brands (same as before)
MEXICAN_BRANDS = [
    "Acura", "Audi", "BYD", "Changan", "Dodge", "Fiat", "Ford", "GAC",
    "GMC", "Geely", "Honda", "Hyundai", "Infiniti", "Jeep", "Kia",
    "Lexus", "Lincoln", "MG", "Mazda", "Mercedes-Benz", "Mini",
    "Mitsubishi", "Nissan", "Peugeot", "Renault", "SEAT", "Subaru",
    "Suzuki", "Tesla", "Toyota", "Volkswagen", "Volvo"
]

# Brand name mapping (CompCar -> our names)
BRAND_MAPPING = {
    "Acura": "Acura", "Audi": "Audi", "BYD": "BYD",
    "Changan Business": "Changan", "Dodge": "Dodge", "FIAT": "Fiat",
    "Ford": "Ford", "GAC": "GAC", "GMC": "GMC", "Geely": "Geely",
    "Honda": "Honda", "Hyundai ": "Hyundai", "Infiniti": "Infiniti",
    "Jeep": "Jeep", "KIA": "Kia", "Lexus": "Lexus", "Lincoln": "Lincoln",
    "MG": "MG", "MAZDA": "Mazda", "Benz": "Mercedes-Benz",
    "MINI": "Mini", "Mitsubishi": "Mitsubishi", "Nissan": "Nissan",
    "Peugeot": "Peugeot", "Renault": "Renault", "Seat": "SEAT",
    "Subaru": "Subaru", "Suzuki": "Suzuki", "TESLA": "Tesla",
    "Toyota": "Toyota", "Volkswagen": "Volkswagen", "Volvo": "Volvo",
}


class VehicleModelDataset(Dataset):
    """Dataset for vehicle model classification."""
    
    def __init__(self, root, transform=None, max_per_class=500):
        self.images = []
        self.labels = []
        self.class_to_idx = {}
        self.transform = transform
        
        root = Path(root)
        for idx, class_dir in enumerate(sorted([d for d in root.iterdir() if d.is_dir()])):
            self.class_to_idx[class_dir.name] = idx
            imgs = list(class_dir.glob('*.jpg'))[:max_per_class]
            for img in imgs:
                self.images.append(img)
                self.labels.append(idx)
        
        self.idx_to_class = {v: k for k, v in self.class_to_idx.items()}
        self.num_classes = len(self.class_to_idx)
    
    def __len__(self):
        return len(self.images)
    
    def __getitem__(self, idx):
        img = Image.open(self.images[idx]).convert('RGB')
        label = self.labels[idx]
        
        if self.transform:
            img = self.transform(img)
        
        return img, label


def prepare_model_dataset(data_dir: Path, output_dir: Path, min_images=10):
    """Prepare dataset organized by model name."""
    console.print("\n[bold]Preparing model dataset...[/bold]")
    
    # Load metadata
    mat_path = data_dir / "misc" / "make_model_name.mat"
    mat = sio.loadmat(mat_path)
    
    # Extract brand and model names
    brands = {}
    for idx, make in enumerate(mat['make_names']):
        if len(make) > 0 and len(make[0]) > 0:
            brand_name = make[0][0]
            if isinstance(brand_name, str):
                brands[idx] = brand_name
    
    models_dict = {}
    for idx, model in enumerate(mat['model_names']):
        if len(model) > 0 and len(model[0]) > 0:
            model_name = model[0][0]
            if isinstance(model_name, str):
                models_dict[idx] = model_name
    
    # Find Mexican market brands
    brand_mapping = {}
    for brand_id, compcar_name in brands.items():
        for compcar_key, our_name in BRAND_MAPPING.items():
            if compcar_name.strip() == compcar_key.strip():
                brand_mapping[brand_id] = {
                    "compcar_name": compcar_name,
                    "our_name": our_name,
                }
                break
    
    console.print(f"Found {len(brand_mapping)} Mexican market brands")
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Process each brand
    total_models = 0
    total_images = 0
    model_stats = []
    
    for brand_id, brand_info in brand_mapping.items():
        brand_name = brand_info["our_name"]
        brand_dir = data_dir / "image" / str(brand_id)
        
        if not brand_dir.exists():
            continue
        
        # Process each model in this brand
        for model_dir in brand_dir.iterdir():
            if not model_dir.is_dir():
                continue
            
            model_id = int(model_dir.name)
            model_name = models_dict.get(model_id, f"Unknown_{model_id}")
            
            # Count images in this model
            model_images = list(model_dir.rglob("*.jpg"))
            if len(model_images) < min_images:
                continue
            
            # Create model directory
            model_label = f"{brand_name}_{model_name}".replace(" ", "_").replace("/", "_")
            model_output_dir = output_dir / model_label
            model_output_dir.mkdir(exist_ok=True)
            
            # Copy images
            copied = 0
            for img_path in model_images[:500]:  # Max 500 per model
                try:
                    img = Image.open(img_path).convert('RGB')
                    dst = model_output_dir / f"{copied:05d}.jpg"
                    img.save(dst, 'JPEG', quality=95)
                    copied += 1
                except Exception as e:
                    pass
            
            if copied >= min_images:
                total_models += 1
                total_images += copied
                model_stats.append({
                    "brand": brand_name,
                    "model": model_name,
                    "images": copied,
                    "label": model_label,
                })
    
    # Save statistics
    stats = {
        "total_models": total_models,
        "total_images": total_images,
        "models": model_stats,
    }
    
    with open(output_dir / "model_stats.json", 'w') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    
    # Display summary
    table = Table(title="Model Dataset Statistics")
    table.add_column("Brand", style="cyan")
    table.add_column("Model", style="green")
    table.add_column("Images", justify="right")
    
    for stat in sorted(model_stats, key=lambda x: x["images"], reverse=True)[:30]:
        table.add_row(stat["brand"], stat["model"], str(stat["images"]))
    
    console.print(table)
    console.print(f"\n[bold green]✓ Dataset prepared![/bold green]")
    console.print(f"  Total: {total_models} models, {total_images} images")
    
    return stats


def main():
    console.print("[bold]Vehicle Model Training[/bold]\n")
    
    # Paths
    compcar_dir = Path("datasets/compcar/extracted/data")
    dataset_dir = Path("datasets/vehicle_models")
    
    # Prepare dataset
    if not (dataset_dir / "train").exists():
        prepare_model_dataset(compcar_dir, dataset_dir)
        
        # Split into train/val
        import shutil
        import random
        random.seed(42)
        
        for split in ["train", "val", "test"]:
            (dataset_dir / split).mkdir(exist_ok=True)
        
        for model_dir in tqdm(list(dataset_dir.iterdir()), desc="Splitting"):
            if model_dir.name in ["train", "val", "test", "model_stats.json"]:
                continue
            if not model_dir.is_dir():
                continue
            
            model_name = model_dir.name
            images = list(model_dir.glob("*.jpg"))
            random.shuffle(images)
            
            n = len(images)
            train_end = int(n * 0.7)
            val_end = int(n * 0.85)
            
            for i, img in enumerate(images):
                if i < train_end:
                    split = "train"
                elif i < val_end:
                    split = "val"
                else:
                    split = "test"
                
                dst = dataset_dir / split / model_name / img.name
                dst.parent.mkdir(exist_ok=True)
                shutil.copy2(img, dst)
            
            shutil.rmtree(model_dir)
    
    # Load datasets
    console.print("\n[bold]Loading datasets...[/bold]")
    
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    train_ds = VehicleModelDataset(dataset_dir / "train", train_transform)
    val_ds = VehicleModelDataset(dataset_dir / "val", val_transform)
    
    console.print(f"Train: {len(train_ds)} images, {train_ds.num_classes} models")
    console.print(f"Val: {len(val_ds)} images")
    
    # Create model
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    console.print(f"Device: {device}")
    
    model = models.mobilenet_v3_large(pretrained=True)
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, train_ds.num_classes)
    model = model.to(device)
    
    # DataLoaders
    train_loader = DataLoader(train_ds, batch_size=32, shuffle=True, num_workers=2, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=2, pin_memory=True)
    
    # Training setup
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=0.001, weight_decay=0.01)
    scheduler = optim.lr_scheduler.CosineAnnealingWarmRestarts(optimizer, T_0=10, T_mult=2, eta_min=1e-6)
    
    # Training
    EPOCHS = 30
    best_acc = 0.0
    patience = 10
    patience_counter = 0
    
    console.print(f"\n[bold]Training for {EPOCHS} epochs...[/bold]\n")
    
    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0
        correct = 0
        total = 0
        
        pbar = tqdm(train_loader, desc=f'Epoch {epoch+1}/{EPOCHS}')
        for images, labels in pbar:
            images, labels = images.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
            
            pbar.set_postfix({'loss': f'{loss.item():.4f}', 'acc': f'{100.*correct/total:.1f}%'})
        
        train_acc = 100. * correct / total
        scheduler.step()
        
        # Validate
        model.eval()
        val_correct = 0
        val_total = 0
        
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                _, predicted = outputs.max(1)
                val_total += labels.size(0)
                val_correct += predicted.eq(labels).sum().item()
        
        val_acc = 100. * val_correct / val_total
        
        console.print(f"Epoch {epoch+1}: Train={train_acc:.1f}% Val={val_acc:.1f}%")
        
        if val_acc > best_acc:
            best_acc = val_acc
            patience_counter = 0
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'val_acc': val_acc,
                'num_classes': train_ds.num_classes,
                'class_to_idx': train_ds.class_to_idx,
                'idx_to_class': train_ds.idx_to_class,
            }, 'best_model_vehicle.pth')
            console.print(f"  ✓ Saved (acc: {val_acc:.1f}%)")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                console.print(f"Early stopping at epoch {epoch+1}")
                break
    
    console.print(f"\n[bold green]✓ Training complete![/bold green]")
    console.print(f"Best accuracy: {best_acc:.1f}%")
    console.print(f"Models: {train_ds.num_classes}")


if __name__ == "__main__":
    main()
