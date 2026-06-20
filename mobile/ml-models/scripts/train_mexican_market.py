"""
train_mexican_market.py
Train MobileNetV3 for Mexican market vehicle classification.
Optimized for brands commonly seen in Mexico.

Usage:
    python scripts/train_mexican_market.py --epochs 30
    python scripts/train_mexican_market.py --epochs 50 --model-size large
"""

import os
import argparse
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms, models
from pathlib import Path
from PIL import Image
from rich.console import Console
from rich.table import Table
from tqdm import tqdm

# Import Mexican brands configuration
from mexican_brands import (
    MEXICAN_MARKET_BRANDS,
    get_all_brands,
    get_models_for_brand,
    COLOR_MAP,
    create_brand_mapping
)

console = Console()


class MexicanVehicleDataset(Dataset):
    """Dataset for Mexican market vehicles."""
    
    def __init__(self, data_dir: Path, split: str, transform=None, target_size=None):
        self.data_dir = data_dir / split
        self.transform = transform
        self.target_size = target_size
        
        # Load all images and labels
        self.images = []
        self.brand_labels = []
        self.color_labels = []
        
        # Get class directories
        if self.data_dir.exists():
            class_dirs = sorted([d for d in self.data_dir.iterdir() if d.is_dir()])
            
            for idx, class_dir in enumerate(class_dirs):
                class_name = class_dir.name
                
                for img_path in class_dir.glob("*.jpg"):
                    self.images.append(img_path)
                    self.brand_labels.append(idx)
                    # TODO: Extract color from image or filename
                    self.color_labels.append(0)  # Placeholder
        
        self.num_classes = len(class_dirs) if self.data_dir.exists() else 0
        self.idx_to_class = {idx: d.name for idx, d in enumerate(class_dirs)} if self.data_dir.exists() else {}
        self.class_to_idx = {v: k for k, v in self.idx_to_class.items()}
        
        console.print(f"  {split}: {len(self.images)} images, {self.num_classes} classes")
    
    def __len__(self):
        return len(self.images)
    
    def __getitem__(self, idx):
        img_path = self.images[idx]
        brand_label = self.brand_labels[idx]
        color_label = self.color_labels[idx]
        
        # Load image
        image = Image.open(img_path).convert('RGB')
        
        # Resize if target_size specified
        if self.target_size:
            image = image.resize(self.target_size, Image.LANCZOS)
        
        if self.transform:
            image = self.transform(image)
        
        return image, brand_label


class MexicanVehicleClassifier(nn.Module):
    """MobileNetV3-based classifier for Mexican market vehicles."""
    
    def __init__(self, num_brands: int, num_colors: int = 12, model_size: str = "small", pretrained: bool = True):
        super().__init__()
        
        # Load pretrained MobileNetV3
        if model_size == "small":
            self.backbone = models.mobilenet_v3_small(pretrained=pretrained)
            num_features = self.backbone.classifier[0].in_features
        else:
            self.backbone = models.mobilenet_v3_large(pretrained=pretrained)
            num_features = self.backbone.classifier[0].in_features
        
        # Shared feature extractor
        self.features = nn.Sequential(
            *list(self.backbone.children())[:-1]
        )
        
        # Brand classifier head
        self.brand_head = nn.Sequential(
            nn.Linear(num_features, 512),
            nn.Hardswish(),
            nn.Dropout(p=0.2),
            nn.Linear(512, 256),
            nn.Hardswish(),
            nn.Dropout(p=0.2),
            nn.Linear(256, num_brands)
        )
        
        # Color classifier head (multi-task)
        self.color_head = nn.Sequential(
            nn.Linear(num_features, 128),
            nn.Hardswish(),
            nn.Dropout(p=0.2),
            nn.Linear(128, num_colors)
        )
    
    def forward(self, x):
        # Extract features
        features = self.features(x)
        features = features.view(features.size(0), -1)
        
        # Classify
        brand_logits = self.brand_head(features)
        color_logits = self.color_head(features)
        
        return brand_logits, color_logits


def get_transforms(img_size: int = 224):
    """Get data transforms for training and validation."""
    
    train_transform = transforms.Compose([
        transforms.Resize((img_size + 32, img_size + 32)),
        transforms.RandomCrop(img_size),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.1),
        transforms.RandomAffine(degrees=0, translate=(0.1, 0.1)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    val_transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    return train_transform, val_transform


def train_epoch(model, dataloader, criterion_brand, criterion_color, optimizer, device):
    """Train for one epoch."""
    model.train()
    running_loss = 0.0
    brand_correct = 0
    total = 0
    
    for images, brand_labels in tqdm(dataloader, desc="Training", leave=False):
        images = images.to(device)
        brand_labels = brand_labels.to(device)
        
        optimizer.zero_grad()
        
        # Forward pass
        brand_logits, color_logits = model(images)
        
        # Calculate loss (only brand for now)
        loss = criterion_brand(brand_logits, brand_labels)
        
        # Backward pass
        loss.backward()
        optimizer.step()
        
        running_loss += loss.item()
        _, predicted = brand_logits.max(1)
        total += brand_labels.size(0)
        brand_correct += predicted.eq(brand_labels).sum().item()
    
    return running_loss / len(dataloader), 100. * brand_correct / total


def validate(model, dataloader, criterion_brand, criterion_color, device):
    """Validate model."""
    model.eval()
    running_loss = 0.0
    brand_correct = 0
    total = 0
    
    with torch.no_grad():
        for images, brand_labels in tqdm(dataloader, desc="Validating", leave=False):
            images = images.to(device)
            brand_labels = brand_labels.to(device)
            
            # Forward pass
            brand_logits, color_logits = model(images)
            
            # Calculate loss
            loss = criterion_brand(brand_logits, brand_labels)
            
            running_loss += loss.item()
            _, predicted = brand_logits.max(1)
            total += brand_labels.size(0)
            brand_correct += predicted.eq(brand_labels).sum().item()
    
    return running_loss / len(dataloader), 100. * brand_correct / total


def train_mexican_vehicle_classifier(
    data_dir: Path,
    output_dir: Path,
    model_size: str = "small",
    epochs: int = 50,
    batch_size: int = 32,
    learning_rate: float = 0.001,
    img_size: int = 224,
    device: str = "auto"
):
    """Train Mexican market vehicle classifier."""
    console.print("\n[bold blue]Training Mexican Market Vehicle Classifier[/bold blue]\n")
    
    # Device setup
    if device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(device)
    
    console.print(f"  Device: {device}")
    
    # Get Mexican brands
    all_brands = get_all_brands()
    num_brands = len(all_brands)
    num_colors = len(COLOR_MAP)
    
    console.print(f"  Brands: {num_brands}")
    console.print(f"  Colors: {num_colors}")
    
    # Data transforms
    train_transform, val_transform = get_transforms(img_size)
    
    # Datasets
    console.print("\n[bold]Loading datasets...[/bold]")
    train_dataset = MexicanVehicleDataset(data_dir, "train", train_transform)
    val_dataset = MexicanVehicleDataset(data_dir, "val", val_transform)
    
    # Dataloaders
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=4)
    
    # Model
    console.print("\n[bold]Creating model...[/bold]")
    model = MexicanVehicleClassifier(
        num_brands=num_brands,
        num_colors=num_colors,
        model_size=model_size,
        pretrained=True
    )
    model = model.to(device)
    
    # Loss and optimizer
    criterion_brand = nn.CrossEntropyLoss()
    criterion_color = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=5, factor=0.5)
    
    # Training config
    table = Table(title="Training Configuration")
    table.add_column("Parameter", style="cyan")
    table.add_column("Value", style="green")
    
    table.add_row("Model", f"MobileNetV3-{model_size}")
    table.add_row("Brands", str(num_brands))
    table.add_row("Colors", str(num_colors))
    table.add_row("Epochs", str(epochs))
    table.add_row("Batch Size", str(batch_size))
    table.add_row("Learning Rate", str(learning_rate))
    table.add_row("Image Size", str(img_size))
    table.add_row("Device", str(device))
    
    console.print(table)
    
    # Training loop
    console.print("\n[bold]Starting training...[/bold]")
    
    best_acc = 0.0
    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": []}
    
    for epoch in range(epochs):
        console.print(f"\nEpoch {epoch+1}/{epochs}")
        
        # Train
        train_loss, train_acc = train_epoch(model, train_loader, criterion_brand, criterion_color, optimizer, device)
        
        # Validate
        val_loss, val_acc = validate(model, val_loader, criterion_brand, criterion_color, device)
        
        # Update scheduler
        scheduler.step(val_loss)
        
        # Save history
        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        
        console.print(f"  Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}%")
        console.print(f"  Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.2f}%")
        
        # Save best model
        if val_acc > best_acc:
            best_acc = val_acc
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # Save model with metadata
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_acc": val_acc,
                "num_brands": num_brands,
                "num_colors": num_colors,
                "brand_to_idx": train_dataset.class_to_idx,
                "idx_to_brand": train_dataset.idx_to_class,
                "color_map": COLOR_MAP,
                "mexican_brands": MEXICAN_MARKET_BRANDS,
            }, output_dir / "best_mexican_model.pth")
            
            console.print(f"  [green]✓ Saved best model (acc: {val_acc:.2f}%)[/green]")
    
    # Save training history
    with open(output_dir / "training_history.json", 'w') as f:
        json.dump(history, f, indent=2)
    
    # Save brand mapping
    brand_mapping = {
        "brand_to_idx": train_dataset.class_to_idx,
        "idx_to_brand": train_dataset.idx_to_class,
        "color_map": COLOR_MAP,
        "mexican_brands": MEXICAN_MARKET_BRANDS,
    }
    with open(output_dir / "brand_mapping.json", 'w') as f:
        json.dump(brand_mapping, f, indent=2, ensure_ascii=False)
    
    console.print(f"\n[bold green]✓ Training complete![/bold green]")
    console.print(f"  Best accuracy: {best_acc:.2f}%")
    console.print(f"  Model saved: {output_dir / 'best_mexican_model.pth'}")
    
    return model, history


def main():
    parser = argparse.ArgumentParser(description="Train Mexican market vehicle classifier")
    parser.add_argument("--data-dir", type=str, default="datasets/compcar",
                       help="Dataset directory")
    parser.add_argument("--output-dir", type=str, default="training/mexican_market",
                       help="Output directory")
    parser.add_argument("--model-size", choices=["small", "large"], default="small",
                       help="MobileNetV3 size")
    parser.add_argument("--epochs", type=int, default=50, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--img-size", type=int, default=224, help="Image size")
    parser.add_argument("--device", type=str, default="auto", help="Device")
    
    args = parser.parse_args()
    
    console.print("[bold]Mexican Market Vehicle Classifier Training[/bold]\n")
    
    # Print brand statistics
    from mexican_brands import print_stats
    print_stats()
    
    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    
    train_mexican_vehicle_classifier(
        data_dir=data_dir,
        output_dir=output_dir,
        model_size=args.model_size,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        img_size=args.img_size,
        device=args.device
    )


if __name__ == "__main__":
    main()
