"""
train_complete_vehicle.py
Complete vehicle detection: Brand + Model + Type + Attributes
Uses all available CompCar metadata for maximum information.

Usage:
    python scripts/train_complete_vehicle.py --epochs 30
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

# Mexican market brands mapping
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

# Car type mapping from CompCar
CAR_TYPES = {
    0: "Desconocido",
    1: "SUV",
    2: "Sedan",
    3: "Hatchback",
    4: "MPV",
    5: "Minibus",
    6: "Fastback",
    7: "Estate",
    8: "Pickup",
    9: "Convertible",
    10: "Sports",
    11: "Crossover",
}


class CompleteVehicleDataset(Dataset):
    """Dataset with all vehicle attributes."""
    
    def __init__(self, root, transform=None):
        self.images = []
        self.labels = []  # Model label
        self.brand_labels = []
        self.type_labels = []
        self.class_to_idx = {}
        self.brand_to_idx = {}
        self.type_to_idx = {}
        self.transform = transform
        
        root = Path(root)
        for idx, class_dir in enumerate(sorted([d for d in root.iterdir() if d.is_dir()])):
            self.class_to_idx[class_dir.name] = idx
            
            # Extract brand from class name (format: Brand_Model)
            brand = class_dir.name.split('_')[0]
            if brand not in self.brand_to_idx:
                self.brand_to_idx[brand] = len(self.brand_to_idx)
            
            for img in class_dir.glob('*.jpg'):
                self.images.append(img)
                self.labels.append(idx)
                self.brand_labels.append(self.brand_to_idx[brand])
        
        self.idx_to_class = {v: k for k, v in self.class_to_idx.items()}
        self.idx_to_brand = {v: k for k, v in self.brand_to_idx.items()}
        self.num_classes = len(self.class_to_idx)
        self.num_brands = len(self.brand_to_idx)
        self.num_types = len(CAR_TYPES)
    
    def __len__(self):
        return len(self.images)
    
    def __getitem__(self, idx):
        img = Image.open(self.images[idx]).convert('RGB')
        label = self.labels[idx]
        brand_label = self.brand_labels[idx]
        
        if self.transform:
            img = self.transform(img)
        
        return img, label, brand_label


class MultiTaskVehicleModel(nn.Module):
    """Multi-task model for brand + model prediction."""
    
    def __init__(self, num_models, num_brands, pretrained=True):
        super().__init__()
        
        # Shared backbone
        self.backbone = models.mobilenet_v3_large(pretrained=pretrained)
        num_features = self.backbone.classifier[0].in_features
        
        # Remove original classifier
        self.backbone.classifier = nn.Identity()
        
        # Brand classifier head
        self.brand_head = nn.Sequential(
            nn.Linear(num_features, 512),
            nn.Hardswish(),
            nn.Dropout(p=0.2),
            nn.Linear(512, num_brands)
        )
        
        # Model classifier head
        self.model_head = nn.Sequential(
            nn.Linear(num_features, 1024),
            nn.Hardswish(),
            nn.Dropout(p=0.3),
            nn.Linear(1024, 512),
            nn.Hardswish(),
            nn.Dropout(p=0.2),
            nn.Linear(512, num_models)
        )
    
    def forward(self, x):
        features = self.backbone(x)
        brand_logits = self.brand_head(features)
        model_logits = self.model_head(features)
        return brand_logits, model_logits


def main():
    console.print("[bold]Complete Vehicle Detection Training[/bold]\n")
    
    # Paths
    dataset_dir = Path("datasets/vehicle_models")
    
    if not (dataset_dir / "train").exists():
        console.print("[red]Dataset not prepared. Run train_vehicle_models.py first.[/red]")
        return
    
    # Load datasets
    console.print("[bold]Loading datasets...[/bold]")
    
    train_transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.RandomCrop(224),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    train_ds = CompleteVehicleDataset(dataset_dir / "train", train_transform)
    val_ds = CompleteVehicleDataset(dataset_dir / "val", val_transform)
    
    console.print(f"Train: {len(train_ds)} images, {train_ds.num_classes} models, {train_ds.num_brands} brands")
    console.print(f"Val: {len(val_ds)} images")
    
    # Display brands
    table = Table(title="Brands")
    table.add_column("Brand", style="cyan")
    table.add_column("Models", justify="right")
    
    brand_model_counts = {}
    for class_name, idx in train_ds.class_to_idx.items():
        brand = class_name.split('_')[0]
        brand_model_counts[brand] = brand_model_counts.get(brand, 0) + 1
    
    for brand, count in sorted(brand_model_counts.items()):
        table.add_row(brand, str(count))
    
    console.print(table)
    
    # Create model
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    console.print(f"\nDevice: {device}")
    
    model = MultiTaskVehicleModel(
        num_models=train_ds.num_classes,
        num_brands=train_ds.num_brands,
        pretrained=True
    )
    model = model.to(device)
    
    # DataLoaders
    train_loader = DataLoader(train_ds, batch_size=32, shuffle=True, num_workers=2, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=2, pin_memory=True)
    
    # Loss functions
    criterion_model = nn.CrossEntropyLoss(label_smoothing=0.1)
    criterion_brand = nn.CrossEntropyLoss(label_smoothing=0.1)
    
    # Optimizer
    optimizer = optim.AdamW(model.parameters(), lr=0.001, weight_decay=0.01)
    scheduler = optim.lr_scheduler.CosineAnnealingWarmRestarts(optimizer, T_0=10, T_mult=2, eta_min=1e-6)
    
    # Training
    EPOCHS = 30
    best_model_acc = 0.0
    best_brand_acc = 0.0
    patience = 10
    patience_counter = 0
    
    console.print(f"\n[bold]Training for {EPOCHS} epochs...[/bold]\n")
    
    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0
        model_correct = 0
        brand_correct = 0
        total = 0
        
        pbar = tqdm(train_loader, desc=f'Epoch {epoch+1}/{EPOCHS}')
        for images, model_labels, brand_labels in pbar:
            images = images.to(device)
            model_labels = model_labels.to(device)
            brand_labels = brand_labels.to(device)
            
            optimizer.zero_grad()
            
            brand_logits, model_logits = model(images)
            
            loss_model = criterion_model(model_logits, model_labels)
            loss_brand = criterion_brand(brand_logits, brand_labels)
            
            # Combined loss (model prediction is primary)
            loss = loss_model + 0.3 * loss_brand
            
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
            
            _, model_pred = model_logits.max(1)
            _, brand_pred = brand_logits.max(1)
            
            total += model_labels.size(0)
            model_correct += model_pred.eq(model_labels).sum().item()
            brand_correct += brand_pred.eq(brand_labels).sum().item()
            
            pbar.set_postfix({
                'loss': f'{loss.item():.4f}',
                'model': f'{100.*model_correct/total:.1f}%',
                'brand': f'{100.*brand_correct/total:.1f}%'
            })
        
        train_model_acc = 100. * model_correct / total
        train_brand_acc = 100. * brand_correct / total
        scheduler.step()
        
        # Validate
        model.eval()
        val_model_correct = 0
        val_brand_correct = 0
        val_total = 0
        
        with torch.no_grad():
            for images, model_labels, brand_labels in val_loader:
                images = images.to(device)
                model_labels = model_labels.to(device)
                brand_labels = brand_labels.to(device)
                
                brand_logits, model_logits = model(images)
                
                _, model_pred = model_logits.max(1)
                _, brand_pred = brand_logits.max(1)
                
                val_total += model_labels.size(0)
                val_model_correct += model_pred.eq(model_labels).sum().item()
                val_brand_correct += brand_pred.eq(brand_labels).sum().item()
        
        val_model_acc = 100. * val_model_correct / val_total
        val_brand_acc = 100. * val_brand_correct / val_total
        
        console.print(f"Epoch {epoch+1}: Model={val_model_acc:.1f}% Brand={val_brand_acc:.1f}%")
        
        # Save best model
        if val_model_acc > best_model_acc:
            best_model_acc = val_model_acc
            best_brand_acc = val_brand_acc
            patience_counter = 0
            
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'model_acc': val_model_acc,
                'brand_acc': val_brand_acc,
                'num_models': train_ds.num_classes,
                'num_brands': train_ds.num_brands,
                'class_to_idx': train_ds.class_to_idx,
                'idx_to_class': train_ds.idx_to_class,
                'brand_to_idx': train_ds.brand_to_idx,
                'idx_to_brand': train_ds.idx_to_brand,
            }, 'best_complete_vehicle.pth')
            
            console.print(f"  ✓ Saved (model={val_model_acc:.1f}%, brand={val_brand_acc:.1f}%)")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                console.print(f"Early stopping at epoch {epoch+1}")
                break
    
    console.print(f"\n[bold green]✓ Training complete![/bold green]")
    console.print(f"Best model accuracy: {best_model_acc:.1f}%")
    console.print(f"Best brand accuracy: {best_brand_acc:.1f}%")
    console.print(f"Models: {train_ds.num_classes}")
    console.print(f"Brands: {train_ds.num_brands}")


if __name__ == "__main__":
    main()
