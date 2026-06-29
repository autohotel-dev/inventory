# ============================================================
# 🚗 Clasificador de Vehículos — México (COMBINADO)
# ============================================================
# COMBINA tu dataset CompCar mexicano (25K imgs) + Stanford Cars
# para resolver el desbalance de marcas (Nissan=28, Mazda=7, etc.)
#
# Output: vehicle_brand_classifier.tflite + vehicle_brand_labels.json
#
# Instrucciones:
#   1. Sube tu carpeta mexican_market/ a Colab (o monta Google Drive)
#   2. Activa GPU: Runtime → Change runtime type → T4 GPU
#   3. Copia cada sección (separada por ===) como celda individual
#   4. Ejecuta todas las celdas en orden (~20 min total)
# ============================================================


# ============================================================
# 📦 CELDA 1: Instalar dependencias
# ============================================================
# Descomenta estas líneas en Colab:
# !pip install -q torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
# !pip install -q ai-edge-torch onnx onnxruntime
# !pip install -q matplotlib seaborn scikit-learn tqdm Pillow datasets

import torch
print(f'PyTorch: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'GPU: {torch.cuda.get_device_name(0)}')


# ============================================================
# 📥 CELDA 2: Subir dataset CompCar y descargar Stanford Cars
# ============================================================
import os
import json
from collections import Counter

# ── OPCIÓN A: Subir el ZIP de mexican_market ──
# Si subiste mexican_market.zip a Colab:
COMPCAR_ZIP = '/content/mexican_market.zip'
COMPCAR_DIR = '/content/mexican_market'

if os.path.exists(COMPCAR_ZIP) and not os.path.exists(COMPCAR_DIR):
    print('📦 Extrayendo mexican_market.zip...')
    os.system(f'unzip -q {COMPCAR_ZIP} -d /content/')

# ── OPCIÓN B: Google Drive ──
# Si lo tienes en Drive, descomenta:
# from google.colab import drive
# drive.mount('/content/drive')
# COMPCAR_DIR = '/content/drive/MyDrive/tu-ruta/mexican_market'

if os.path.exists(COMPCAR_DIR):
    print(f'✅ CompCar dataset encontrado: {COMPCAR_DIR}')
    # Count images
    total = sum(len(files) for _, _, files in os.walk(os.path.join(COMPCAR_DIR, 'train')))
    print(f'   {total} imágenes de entrenamiento')
else:
    print(f'⚠️ No se encontró {COMPCAR_DIR}')
    print('   Sube mexican_market.zip o monta Google Drive')

# ── Descargar Stanford Cars desde HuggingFace ──
print('\n📥 Descargando Stanford Cars (complemento)...')
try:
    from datasets import load_dataset
    stanford_ds = load_dataset('tanganke/stanford_cars', trust_remote_code=True)
    STANFORD_AVAILABLE = True
    print(f'✅ Stanford Cars: {len(stanford_ds["train"])} train, {len(stanford_ds["test"])} test')
except Exception as e:
    print(f'⚠️ Stanford Cars no disponible: {e}')
    STANFORD_AVAILABLE = False


# ============================================================
# 🏷️ CELDA 3: Definir marcas y crear mapeo unificado
# ============================================================

# Marcas FINALES para el modelo (relevantes para México)
# Excluimos: Geely, GAC, Changan (solo China), y ultra-raras
FINAL_BRANDS = {
    'Nissan', 'Chevrolet', 'Toyota', 'Volkswagen', 'Honda', 'Ford',
    'Mazda', 'Hyundai', 'Kia', 'Dodge', 'Jeep', 'BMW', 'Mercedes-Benz',
    'Audi', 'Suzuki', 'Mitsubishi', 'Subaru', 'Volvo', 'MINI',
    'Chrysler', 'GMC', 'Cadillac', 'Buick', 'Lincoln', 'Acura',
    'Infiniti', 'Tesla', 'FIAT', 'Porsche', 'Lexus', 'Renault',
    'Peugeot', 'SEAT', 'BYD', 'MG', 'Isuzu',
    'Land Rover', 'Jaguar',
}

# Marcas a EXCLUIR del CompCar (no son del mercado mexicano)
EXCLUDE_BRANDS = {'Geely', 'GAC', 'Changan'}

# Mapeos para unificar nombres entre datasets
BRAND_NORMALIZE = {
    # CompCar variations
    'Mini': 'MINI',
    'Fiat': 'FIAT',
    # Stanford Cars variations
    'Ram': 'Dodge',
    'Scion': 'Toyota',
    'Daewoo': 'Chevrolet',
    'Geo': 'Chevrolet',
    'Eagle': 'Chrysler',
    'Plymouth': 'Chrysler',
    'HUMMER': 'GMC',
    'Maybach': 'Mercedes-Benz',
    'smart': 'Mercedes-Benz',
    'AM General': 'GMC',
}

# Stanford Cars: marcas ultra-raras a excluir
STANFORD_EXCLUDE = {
    'Aston Martin', 'Bentley', 'Bugatti', 'Ferrari',
    'Fisker', 'Lamborghini', 'McLaren', 'Rolls-Royce', 'Spyker',
}


def normalize_brand(brand):
    """Normaliza nombre de marca"""
    if brand in BRAND_NORMALIZE:
        return BRAND_NORMALIZE[brand]
    return brand


def extract_stanford_brand(class_name):
    """Extrae marca de 'BMW M3 Coupe 2012'"""
    multi = ['AM General', 'Aston Martin', 'Land Rover', 'Rolls-Royce', 'Mercedes-Benz']
    for mw in multi:
        if class_name.startswith(mw):
            return mw
    return class_name.split()[0]


# ── Procesar Stanford Cars labels ──
stanford_class_to_brand = {}
if STANFORD_AVAILABLE:
    stanford_class_names = stanford_ds['train'].features['label'].names
    for i, name in enumerate(stanford_class_names):
        raw = extract_stanford_brand(name)
        if raw in STANFORD_EXCLUDE:
            continue
        brand = normalize_brand(raw)
        stanford_class_to_brand[i] = brand

# ── Obtener lista unificada de marcas ──
all_brands = set()

# Desde CompCar
if os.path.exists(os.path.join(COMPCAR_DIR, 'train')):
    for brand_dir in os.listdir(os.path.join(COMPCAR_DIR, 'train')):
        brand = normalize_brand(brand_dir)
        if brand not in EXCLUDE_BRANDS:
            all_brands.add(brand)

# Desde Stanford
all_brands.update(stanford_class_to_brand.values())

# Crear índices
unique_brands = sorted(all_brands)
brand_to_idx = {b: i for i, b in enumerate(unique_brands)}
idx_to_brand = {i: b for b, i in brand_to_idx.items()}

print(f'✅ {len(unique_brands)} marcas finales:')
top9 = {'Nissan', 'Chevrolet', 'Toyota', 'Volkswagen', 'Honda', 'Ford', 'Mazda', 'Hyundai', 'Kia'}
for brand in unique_brands:
    emoji = '🇲🇽' if brand in top9 else '  '
    print(f'  {emoji} {brand_to_idx[brand]:2d}. {brand}')

# Guardar labels
labels_json = {str(i): brand for i, brand in idx_to_brand.items()}
with open('/content/vehicle_brand_labels.json', 'w') as f:
    json.dump(labels_json, f, indent=2)
print(f'\n💾 Labels: {len(labels_json)} marcas')


# ============================================================
# 📊 CELDA 4: Crear DataLoaders combinados
# ============================================================
import torch
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler, ConcatDataset
from torchvision import transforms
from PIL import Image
import numpy as np
from tqdm import tqdm
from pathlib import Path

IMG_SIZE = 224
BATCH_SIZE = 64

# Augmentation
train_transform = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.RandomCrop(IMG_SIZE),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.1),
    transforms.RandomAffine(degrees=0, translate=(0.1, 0.1), scale=(0.9, 1.1)),
    transforms.RandomGrayscale(p=0.05),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    transforms.RandomErasing(p=0.2),
])

val_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


class FolderBrandDataset(Dataset):
    """Dataset desde carpeta con estructura brand/image.jpg"""
    def __init__(self, root_dir, transform=None):
        self.transform = transform
        self.samples = []
        self.label_counts = Counter()

        exts = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
        for brand_dir in sorted(os.listdir(root_dir)):
            brand_path = os.path.join(root_dir, brand_dir)
            if not os.path.isdir(brand_path):
                continue

            brand = normalize_brand(brand_dir)
            if brand in EXCLUDE_BRANDS or brand not in brand_to_idx:
                continue

            label = brand_to_idx[brand]
            for img_file in os.listdir(brand_path):
                if Path(img_file).suffix.lower() in exts:
                    self.samples.append((os.path.join(brand_path, img_file), label))
                    self.label_counts[label] += 1

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        try:
            img = Image.open(path).convert('RGB')
        except:
            # Fallback: return random noise if image is corrupted
            img = Image.fromarray(np.random.randint(0, 255, (IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8))

        if self.transform:
            img = self.transform(img)
        return img, label


class StanfordBrandDataset(Dataset):
    """Dataset wrapper para Stanford Cars de HuggingFace"""
    def __init__(self, hf_split, transform=None):
        self.transform = transform
        self.hf = hf_split
        self.samples = []
        self.label_counts = Counter()

        for i in range(len(hf_split)):
            orig_label = hf_split[i]['label']
            if orig_label in stanford_class_to_brand:
                brand = stanford_class_to_brand[orig_label]
                if brand in brand_to_idx:
                    label = brand_to_idx[brand]
                    self.samples.append((i, label))
                    self.label_counts[label] += 1

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        hf_idx, label = self.samples[idx]
        img = self.hf[hf_idx]['image']
        if not isinstance(img, Image.Image):
            img = Image.fromarray(img)
        img = img.convert('RGB')
        if self.transform:
            img = self.transform(img)
        return img, label


# ── Crear datasets ──
print('📊 Creando datasets combinados...')

train_datasets = []
val_datasets = []

# 1. CompCar Mexican Market
if os.path.exists(os.path.join(COMPCAR_DIR, 'train')):
    cc_train = FolderBrandDataset(os.path.join(COMPCAR_DIR, 'train'), train_transform)
    cc_val = FolderBrandDataset(os.path.join(COMPCAR_DIR, 'val'), val_transform)
    train_datasets.append(cc_train)
    val_datasets.append(cc_val)
    print(f'  CompCar train: {len(cc_train)} imágenes')
    print(f'  CompCar val:   {len(cc_val)} imágenes')

# 2. Stanford Cars
if STANFORD_AVAILABLE:
    sc_train = StanfordBrandDataset(stanford_ds['train'], train_transform)
    sc_val = StanfordBrandDataset(stanford_ds['test'], val_transform)
    train_datasets.append(sc_train)
    val_datasets.append(sc_val)
    print(f'  Stanford train: {len(sc_train)} imágenes')
    print(f'  Stanford val:   {len(sc_val)} imágenes')

# 3. CompCar test como extra training data (opcional)
if os.path.exists(os.path.join(COMPCAR_DIR, 'test')):
    cc_test = FolderBrandDataset(os.path.join(COMPCAR_DIR, 'test'), train_transform)
    # Usar test como training extra solo si tenemos Stanford para validación
    if STANFORD_AVAILABLE:
        train_datasets.append(cc_test)
        print(f'  CompCar test (extra train): {len(cc_test)} imágenes')

# Combinar
class CombinedDataset(Dataset):
    """Combina múltiples datasets con label_counts unificado"""
    def __init__(self, datasets):
        self.datasets = datasets
        self.samples = []
        self.label_counts = Counter()
        self._offsets = []

        offset = 0
        for ds in datasets:
            self._offsets.append(offset)
            offset += len(ds)
            for k, v in ds.label_counts.items():
                self.label_counts[k] += v
            self.samples.extend([(i, ds) for i in range(len(ds))])

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        ds_idx, ds = self.samples[idx]
        return ds[ds_idx]


train_combined = CombinedDataset(train_datasets)
val_combined = CombinedDataset(val_datasets)

print(f'\n📊 Dataset COMBINADO:')
print(f'  Train total: {len(train_combined)} imágenes')
print(f'  Val total:   {len(val_combined)} imágenes')
print(f'  Clases: {len(unique_brands)}')

# Weighted sampler
sample_weights = []
for idx in range(len(train_combined)):
    _, label = train_combined[idx] if hasattr(train_combined, '__getitem__') else (None, 0)
    # Use the label_counts to compute weight
    ds_idx, ds = train_combined.samples[idx]
    _, label = ds.samples[ds_idx] if hasattr(ds.samples[ds_idx], '__len__') else (None, ds.samples[ds_idx][1] if isinstance(ds.samples[ds_idx], tuple) else 0)
    sample_weights.append(1.0 / max(train_combined.label_counts.get(label, 1), 1))

sampler = WeightedRandomSampler(sample_weights, len(sample_weights), replacement=True)

train_loader = DataLoader(train_combined, batch_size=BATCH_SIZE, sampler=sampler,
                          num_workers=2, pin_memory=True, drop_last=True)
val_loader = DataLoader(val_combined, batch_size=BATCH_SIZE, shuffle=False,
                        num_workers=2, pin_memory=True)

# Distribución final
print('\n📈 Distribución combinada (train):')
for idx in sorted(train_combined.label_counts.keys()):
    brand = idx_to_brand[idx]
    count = train_combined.label_counts[idx]
    bar = '█' * (count // 20)
    flag = '🇲🇽' if brand in top9 else '  '
    print(f'  {flag} {brand:15s} {count:5d} {bar}')


# ============================================================
# 🧠 CELDA 5: Definir modelo MobileNetV3-Large
# ============================================================
import torchvision.models as models
import torch.nn as nn

NUM_CLASSES = len(unique_brands)
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f'Device: {device}')

model = models.mobilenet_v3_large(weights=models.MobileNet_V3_Large_Weights.IMAGENET1K_V2)

# Reemplazar clasificador
in_features = model.classifier[3].in_features
model.classifier[3] = nn.Linear(in_features, NUM_CLASSES)
model = model.to(device)

total_params = sum(p.numel() for p in model.parameters())
print(f'\n📐 MobileNetV3-Large')
print(f'   Parámetros: {total_params:,}')
print(f'   Clases: {NUM_CLASSES}')
print(f'   Input: {IMG_SIZE}x{IMG_SIZE}x3')


# ============================================================
# 🏋️ CELDA 6: Entrenar (30 épocas)
# ============================================================
from torch.optim.lr_scheduler import CosineAnnealingWarmRestarts
import time

NUM_EPOCHS = 30
LR = 3e-4

backbone_params = [p for n, p in model.named_parameters() if 'classifier' not in n]
classifier_params = [p for n, p in model.named_parameters() if 'classifier' in n]

optimizer = torch.optim.AdamW([
    {'params': backbone_params, 'lr': LR * 0.1},
    {'params': classifier_params, 'lr': LR},
], weight_decay=1e-4)

scheduler = CosineAnnealingWarmRestarts(optimizer, T_0=10, T_mult=2, eta_min=1e-6)
criterion = nn.CrossEntropyLoss(label_smoothing=0.1)

best_val_acc = 0.0
history = {'train_loss': [], 'val_loss': [], 'train_acc': [], 'val_acc': []}

print(f'🏋️ Entrenando {NUM_EPOCHS} épocas...')
print('=' * 70)

for epoch in range(NUM_EPOCHS):
    start = time.time()

    model.train()
    train_loss, train_correct, train_total = 0, 0, 0

    pbar = tqdm(train_loader, desc=f'Epoch {epoch+1}/{NUM_EPOCHS}', leave=False)
    for images, labels in pbar:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        train_loss += loss.item() * images.size(0)
        _, predicted = outputs.max(1)
        train_total += labels.size(0)
        train_correct += predicted.eq(labels).sum().item()
        pbar.set_postfix(loss=f'{loss.item():.3f}', acc=f'{100*train_correct/train_total:.1f}%')

    scheduler.step()

    model.eval()
    val_loss, val_correct, val_total = 0, 0, 0
    with torch.no_grad():
        for images, labels in val_loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)
            val_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            val_total += labels.size(0)
            val_correct += predicted.eq(labels).sum().item()

    t_loss = train_loss / train_total
    v_loss = val_loss / val_total
    t_acc = 100 * train_correct / train_total
    v_acc = 100 * val_correct / val_total

    history['train_loss'].append(t_loss)
    history['val_loss'].append(v_loss)
    history['train_acc'].append(t_acc)
    history['val_acc'].append(v_acc)

    improved = ''
    if v_acc > best_val_acc:
        best_val_acc = v_acc
        torch.save(model.state_dict(), '/content/best_model.pth')
        improved = ' ⭐'

    print(f'Epoch {epoch+1:2d}/{NUM_EPOCHS} | Train: {t_acc:.1f}% | Val: {v_acc:.1f}% | {time.time()-start:.0f}s{improved}')

print('=' * 70)
print(f'🏆 Mejor val accuracy: {best_val_acc:.1f}%')


# ============================================================
# 📊 CELDA 7: Evaluar por marca
# ============================================================
import matplotlib.pyplot as plt
from sklearn.metrics import classification_report, confusion_matrix

model.load_state_dict(torch.load('/content/best_model.pth'))
model.eval()

# Curvas
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
ax1.plot(history['train_loss'], label='Train'); ax1.plot(history['val_loss'], label='Val')
ax1.set_title('Loss'); ax1.legend(); ax1.grid(alpha=0.3)
ax2.plot(history['train_acc'], label='Train'); ax2.plot(history['val_acc'], label='Val')
ax2.set_title('Accuracy (%)'); ax2.legend(); ax2.grid(alpha=0.3)
plt.tight_layout(); plt.savefig('/content/training_curves.png', dpi=150); plt.show()

all_preds, all_labels = [], []
with torch.no_grad():
    for images, labels in tqdm(val_loader, desc='Evaluando'):
        images = images.to(device)
        outputs = model(images)
        _, predicted = outputs.max(1)
        all_preds.extend(predicted.cpu().numpy())
        all_labels.extend(labels.numpy())

present_labels = sorted(set(all_labels))
present_names = [idx_to_brand[i] for i in present_labels]
print('\n📊 Reporte por marca:')
print(classification_report(all_labels, all_preds,
                            labels=present_labels,
                            target_names=present_names,
                            digits=2, zero_division=0))


# ============================================================
# 📦 CELDA 8: Exportar a TFLite
# ============================================================
print('📦 Exportando a TFLite...')
model.load_state_dict(torch.load('/content/best_model.pth'))
model.eval()
model_cpu = model.cpu()

try:
    import ai_edge_torch
    dummy = torch.randn(1, 3, IMG_SIZE, IMG_SIZE)
    edge = ai_edge_torch.convert(model_cpu, (dummy,))
    edge.export('/content/vehicle_brand_classifier.tflite')
    sz = os.path.getsize('/content/vehicle_brand_classifier.tflite') / (1024*1024)
    print(f'✅ TFLite: {sz:.1f} MB')
    EXPORT_OK = True
except Exception as e:
    print(f'ai_edge_torch falló: {e}, usando ONNX...')
    EXPORT_OK = False

if not EXPORT_OK:
    import onnx
    dummy = torch.randn(1, 3, IMG_SIZE, IMG_SIZE)
    torch.onnx.export(model_cpu, dummy, '/content/model.onnx',
                      input_names=['input'], output_names=['output'], opset_version=13)
    os.system('pip install -q onnx2tf tensorflow')
    import numpy as np
    if not hasattr(np, 'object'): np.object = object; np.bool = bool
    os.system('onnx2tf -i /content/model.onnx -o /content/tf_model -osd')
    import glob, shutil
    tfs = glob.glob('/content/tf_model/*float32*.tflite')
    if tfs:
        shutil.copy(tfs[0], '/content/vehicle_brand_classifier.tflite')
        sz = os.path.getsize('/content/vehicle_brand_classifier.tflite') / (1024*1024)
        print(f'✅ TFLite: {sz:.1f} MB')
        EXPORT_OK = True

print(f'\n🎉 Archivos:')
print(f'   📱 vehicle_brand_classifier.tflite ({sz:.1f} MB)')
print(f'   🏷️ vehicle_brand_labels.json ({len(labels_json)} marcas)')


# ============================================================
# ✅ CELDA 9: Validar TFLite
# ============================================================
import numpy as np
try:
    import tensorflow as tf
except:
    os.system('pip install -q tensorflow')
    import tensorflow as tf

interp = tf.lite.Interpreter(model_path='/content/vehicle_brand_classifier.tflite')
interp.allocate_tensors()
inp_det = interp.get_input_details()
out_det = interp.get_output_details()

print(f'Input:  {inp_det[0]["shape"]} {inp_det[0]["dtype"]}')
print(f'Output: {out_det[0]["shape"]} {out_det[0]["dtype"]}')

# Batch test
print('\n🔄 Validando TFLite (100 muestras)...')
correct = 0
total = min(100, len(val_combined))
for i in range(total):
    img, label = val_combined[i]
    inp = np.transpose(img.numpy(), (1, 2, 0))
    inp = np.expand_dims(inp, 0).astype(np.float32)
    interp.set_tensor(inp_det[0]['index'], inp)
    interp.invoke()
    out = interp.get_tensor(out_det[0]['index'])[0]
    if np.argmax(out) == label:
        correct += 1

print(f'TFLite accuracy: {100*correct/total:.1f}%')
print('🎉 Listo!')


# ============================================================
# 📥 CELDA 10: Descargar
# ============================================================
from google.colab import files

print('📥 Descarga:')
print('   1. vehicle_brand_classifier.tflite -> mobile/assets/models/')
print('   2. vehicle_brand_labels.json -> mobile/assets/models/')

files.download('/content/vehicle_brand_classifier.tflite')
files.download('/content/vehicle_brand_labels.json')
