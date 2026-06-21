#!/bin/bash
# download_compcar_bg.sh
# Download CompCar dataset in background with progress
#
# Usage: nohup bash download_compcar_bg.sh > download.log 2>&1 &
# Check progress: tail -f download.log

set -e

DATASET_DIR="/home/epigibson/Documentos/Desarrollos/inventory/mobile/ml-models/datasets/compcar"
PASSWORD="d89551fd190e38"
LOG_FILE="/home/epigibson/Documentos/Desarrollos/inventory/mobile/ml-models/download.log"

echo "==========================================" | tee -a "$LOG_FILE"
echo "  CompCar Dataset Download" | tee -a "$LOG_FILE"
echo "  Started: $(date)" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"

mkdir -p "$DATASET_DIR"
cd "$DATASET_DIR"

# Function to download from Google Drive
download_from_gdrive() {
    local file_id="$1"
    local output="$2"
    
    echo "Downloading: $output" | tee -a "$LOG_FILE"
    
    # Use wget with Google Drive direct download link
    wget --no-check-certificate "https://drive.google.com/uc?export=download&id=${file_id}" -O "$output" 2>&1 | tee -a "$LOG_FILE"
}

# Alternative: Use aria2 for faster parallel downloads
download_with_aria2() {
    echo "Using aria2 for parallel download..." | tee -a "$LOG_FILE"
    
    # Create aria2 input file with all data files
    cat > aria2_input.txt << 'EOF'
https://drive.google.com/uc?export=download&id=FILE_ID_1  out=data.z01
https://drive.google.com/uc?export=download&id=FILE_ID_2  out=data.z02
# ... add all file IDs
EOF
    
    aria2c -i aria2_input.txt -j 4 -x 4 --file-allocation=none 2>&1 | tee -a "$LOG_FILE"
}

# Check if files already downloaded
echo "" | tee -a "$LOG_FILE"
echo "[1/3] Checking existing files..." | tee -a "$LOG_FILE"
EXISTING=$(ls -la data.* 2>/dev/null | wc -l)
echo "  Found $EXISTING data files" | tee -a "$LOG_FILE"

if [ "$EXISTING" -ge 23 ]; then
    echo "  All files present, skipping download" | tee -a "$LOG_FILE"
else
    echo "" | tee -a "$LOG_FILE"
    echo "[2/3] Download files manually:" | tee -a "$LOG_FILE"
    echo "  1. Open: https://drive.google.com/drive/folders/18EunmjOJsbE5Lh9zA0cZ4wKV6Um46dkg" | tee -a "$LOG_FILE"
    echo "  2. Download ALL 'data.*' files to: $DATASET_DIR" | tee -a "$LOG_FILE"
    echo "  3. Run this script again after download" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "  Or use gdown (install: pip install gdown):" | tee -a "$LOG_FILE"
    echo "  gdown --folder 'https://drive.google.com/drive/folders/18EunmjOJsbE5Lh9zA0cZ4wKV6Um46dkg' --remaining-ok" | tee -a "$LOG_FILE"
    exit 0
fi

# Combine split files
echo "" | tee -a "$LOG_FILE"
echo "[3/3] Combining and extracting..." | tee -a "$LOG_FILE"
echo "  This will take several minutes for 8.6GB..." | tee -a "$LOG_FILE"

# Step 1: Combine split zip
echo "  Combining split files..." | tee -a "$LOG_FILE"
zip -F data.zip --out combined.zip 2>&1 | tee -a "$LOG_FILE"

# Step 2: Extract with password
echo "  Extracting (this may take 5-10 minutes)..." | tee -a "$LOG_FILE"
unzip -P "$PASSWORD" combined.zip 2>&1 | tee -a "$LOG_FILE"

# Step 3: Cleanup
echo "  Cleaning up..." | tee -a "$LOG_FILE"
rm -f combined.zip

echo "" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
echo "  ✓ Download complete!" | tee -a "$LOG_FILE"
echo "  Finished: $(date)" | tee -a "$LOG_FILE"
echo "  Location: $DATASET_DIR" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
