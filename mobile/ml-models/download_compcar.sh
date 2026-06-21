#!/bin/bash
# download_compcar.sh
# Download CompCar dataset from Google Drive
#
# Usage: bash download_compcar.sh

set -e

DATASET_DIR="datasets/compcar"
PASSWORD="d89551fd190e38"

echo "=========================================="
echo "  CompCar Dataset Downloader"
echo "=========================================="
echo ""

# Create directory
mkdir -p "$DATASET_DIR"
cd "$DATASET_DIR"

# Google Drive folder ID
GDRIVE_FOLDER="18EunmjOJsbE5Lh9zA0cZ4wKV6Um46dkg"

echo "[1/4] Downloading data files from Google Drive..."
echo "  This will download data.zip and data.z01-data.z22"
echo "  Total size: ~1.2 GB"
echo ""

# Try gdown first
if command -v gdown &> /dev/null; then
    echo "Using gdown..."
    gdown --folder "https://drive.google.com/drive/folders/${GDRIVE_FOLDER}" --remaining-ok
else
    echo "gdown not installed. Install with: pip install gdown"
    echo ""
    echo "Or download manually from:"
    echo "  Google Drive: https://drive.google.com/drive/folders/${GDRIVE_FOLDER}"
    echo "  Dropbox: https://www.dropbox.com/sh/46de2cre37fvzu6/AABXtX8QqA6sx37k1IyZmNQ2a"
    echo ""
    echo "Download all files named 'data.*' (data.zip, data.z01-data.z22)"
    echo "Place them in: $(pwd)"
    echo ""
    read -p "Press Enter after downloading files manually..."
fi

# Check if files exist
echo ""
echo "[2/4] Checking downloaded files..."
DATA_FILES=$(ls data.* 2>/dev/null | wc -l)
echo "  Found $DATA_FILES data files"

if [ "$DATA_FILES" -lt 23 ]; then
    echo "  WARNING: Expected 23 files (data.zip + data.z01-data.z22)"
    echo "  Please download all files and try again"
    exit 1
fi

# Combine split zip files
echo ""
echo "[3/4] Combining split zip files..."
zip -F data.zip --out combined.zip

# Extract with password
echo ""
echo "[4/4] Extracting with password..."
unzip -P "$PASSWORD" combined.zip

# Cleanup
echo ""
echo "Cleaning up temporary files..."
rm -f combined.zip

echo ""
echo "=========================================="
echo "  ✓ Download complete!"
echo "=========================================="
echo ""
echo "Dataset location: $(pwd)"
echo ""
echo "Next steps:"
echo "  1. Check README.txt for dataset description"
echo "  2. Run: python ../../scripts/02_prepare_data.py"
