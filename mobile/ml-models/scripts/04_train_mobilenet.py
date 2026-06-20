"""
04_train_mobilenet.py
Train MobileNetV3 for vehicle brand/model/color classification.

Usage:
    python scripts/04_train_mobilenet.py --dataset compcar --epochs 50
    python scripts/04_train_mobilenet.py --dataset stanford --epochs 30
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

console = Console()


class VehicleDataset(Dataset):
    """Custom dataset for vehicle classification."""
    
    def __init__(self, data_dir: Path, split: str, transform=None):
        self.data_dir = data_dir / split
        self.transform = transform
        
        # Load all images and labels
        self.images = []
        self.labels = []
        self.class_to_idx = {}
        
        # Get class directories
        class_dirs = sorted([d for d in self.data_dir.iterdir() if d.is_dir()])
        
        for idx, class_dir in enumerate(class_dirs):
            class_name = class_dir.name
            self.class_to_idx[class_name] = idx
            
            for img_path in class_dir.glob("*.jpg"):
                self.images.append(img_path)
                self.labels.append(idx)
        
        self.idx_to_class = {v: k for k, v in self.class_to_idx.items()}
        self.num_classes = len(self.class_to_idx)
        
        console.print(f"  {split}: {len(self.images)} images, {self.num_classes} classes")
    
    def __len__(self):
        return len(self.images)
    
    def __getitem__(self, idx):
        img_path = self.images[idx]
        label = self.labels[idx]
        
        image = Image.open(img_path).convert('RGB')
        
        if self.transform:
            image = self.transform(image)
        
        return image, label


class VehicleClassifier(nn.Module):
    """MobileNetV3-based vehicle classifier."""
    
    def __init__(self, num_classes: int, model_size: str = "small", pretrained: bool = True):
        super().__init__()
        
        # Load pretrained MobileNetV3
        if model_size == "small":
            self.backbone = models.mobilenet_v3_small(pretrained=pretrained)
            num_features = self.backbone.classifier[0].in_features
        else:
            self.backbone = models.mobilenet_v3_large(pretrained=pretrained)
            num_features = self.backbone.classifier[0].in_features
        
        # Replace classifier
        self.backbone.classifier = nn.Sequential(
            nn.Linear(num_features, 512),
            nn.Hardswish(),
            nn.Dropout(p=0.2),
            nn.Linear(512, 256),
            nn.Hardswish(),
            nn.Dropout(p=0.2),
            nn.Linear(256, num_classes)
        )
    
    def forward(self, x):
        return self.backbone(x)


def get_transforms(img_size: int = 224):
    """Get data transforms for training and validation."""
    
    train_transform = transforms.Compose([
        transforms.Resize((img_size + 32, img_size + 32)),
        transforms.RandomCrop(img_size),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    val_transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    return train_transform, val_transform


def train_epoch(model, dataloader, criterion, optimizer, device):
    """Train for one epoch."""
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    
    for images, labels in tqdm(dataloader, desc="Training", leave=False):
        images, labels = images.to(device), labels.to(device)
        
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        
        running_loss += loss.item()
        _, predicted = outputs.max(1)
        total += labels.size(0)
        correct += predicted.eq(labels).sum().item()
    
    return running_loss / len(dataloader), 100. * correct / total


def validate(model, dataloader, criterion, device):
    """Validate model."""
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    
    with torch.no_grad():
        for images, labels in tqdm(dataloader, desc="Validating", leave=False):
            images, labels = images.to(device), labels.to(device)
            
            outputs = model(images)
            loss = criterion(outputs, labels)
            
            running_loss += loss.item()
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
    
    return running_loss / len(dataloader), 100. * correct / total


def train_mobilenet(
    data_dir: Path,
    output_dir: Path,
    model_size: str = "small",
    epochs: int = 50,
    batch_size: int = 32,
    learning_rate: float = 0.001,
    img_size: int = 224,
    device: str = "auto"
):
    """Train MobileNet model."""
    console.print("\n[bold blue]Training MobileNetV3[/bold blue]\n")
    
    # Device setup
    if device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(device)
    
    console.print(f"  Device: {device}")
    
    # Data transforms
    train_transform, val_transform = get_transforms(img_size)
    
    # Datasets
    console.print("\n[bold]Loading datasets...[/bold]")
    train_dataset = VehicleDataset(data_dir, "train", train_transform)
    val_dataset = VehicleDataset(data_dir, "val", val_transform)
    
    # Dataloaders
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=4)
    
    # Model
    console.print("\n[bold]Creating model...[/bold]")
    model = VehicleClassifier(
        num_classes=train_dataset.num_classes,
        model_size=model_size,
        pretrained=True
    )
    model = model.to(device)
    
    # Loss and optimizer
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=5, factor=0.5)
    
    # Training config
    table = Table(title="Training Configuration")
    table.add_column("Parameter", style="cyan")
    table.add_column("Value", style="green")
    
    table.add_row("Model", f"MobileNetV3-{model_size}")
    table.add_row("Classes", str(train_dataset.num_classes))
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
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        
        # Validate
        val_loss, val_acc = validate(model, val_loader, criterion, device)
        
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
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_acc": val_acc,
                "num_classes": train_dataset.num_classes,
                "class_to_idx": train_dataset.class_to_idx,
                "idx_to_class": train_dataset.idx_to_class,
            }, output_dir / "best_model.pth")
            console.print(f"  [green]✓ Saved best model (acc: {val_acc:.2f}%)[/green]")
    
    # Save training history
    with open(output_dir / "history.json", 'w') as f:
        json.dump(history, f, indent=2)
    
    console.print(f"\n[bold green]✓ Training complete![/bold green]")
    console.print(f"  Best accuracy: {best_acc:.2f}%")
    console.print(f"  Model saved: {output_dir / 'best_model.pth'}")
    
    return model, history


def main():
    parser = argparse.ArgumentParser(description="Train MobileNet for vehicle classification")
    parser.add_argument("--dataset", choices=["compcar", "stanford", "synthetic"], default="compcar",
                       help="Dataset to use")
    parser.add_argument("--data-dir", type=str, default="datasets/prepared",
                       help="Prepared dataset directory")
    parser.add_argument("--output-dir", type=str, default="training/mobilenet",
                       help="Output directory")
    parser.add_argument("--model-size", choices=["small", "large"], default="small",
                       help="MobileNetV3 size")
    parser.add_argument("--epochs", type=int, default=50, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--img-size", type=int, default=224, help="Image size")
    parser.add_argument("--device", type=str, default="auto", help="Device")
    
    args = parser.parse_args()
    
    console.print("[bold]MobileNet Vehicle Classification Training[/bold]\n")
    
    data_dir = Path(args.data_dir)
    
    # Handle different dataset structures
    if args.dataset == "synthetic":
        # Synthetic dataset is directly in data_dir
        pass
    else:
        # Other datasets are in subdirectories
        data_dir = data_dir / args.dataset
    
    output_dir = Path(args.output_dir)
    
    train_mobilenet(
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
