#!/bin/bash
# prepare_for_colab.sh
# Create a zip file of the Mexican market dataset for uploading to Google Colab
#
# Usage: bash prepare_for_colab.sh

set -e

DATASET_DIR="datasets/mexican_market"
OUTPUT_FILE="datasets/mexican_market.zip"

echo "=========================================="
echo "  Preparing Dataset for Google Colab"
echo "=========================================="
echo ""

# Check if dataset exists
if [ ! -d "$DATASET_DIR/train" ]; then
    echo "Error: Dataset not found at $DATASET_DIR"
    echo "Run: python scripts/prepare_mexican_dataset.py first"
    exit 1
fi

# Count images
TRAIN_COUNT=$(find "$DATASET_DIR/train" -name "*.jpg" | wc -l)
VAL_COUNT=$(find "$DATASET_DIR/val" -name "*.jpg" | wc -l)
TEST_COUNT=$(find "$DATASET_DIR/test" -name "*.jpg" | wc -l)
BRAND_COUNT=$(ls -d "$DATASET_DIR/train"/*/ | wc -l)

echo "Dataset statistics:"
echo "  Brands: $BRAND_COUNT"
echo "  Train: $TRAIN_COUNT images"
echo "  Val: $VAL_COUNT images"
echo "  Test: $TEST_COUNT images"
echo "  Total: $((TRAIN_COUNT + VAL_COUNT + TEST_COUNT)) images"
echo ""

# Create zip
echo "Creating zip file..."
cd "$(dirname "$DATASET_DIR")"
zip -r "$(basename "$OUTPUT_FILE")" "$(basename "$DATASET_DIR")" -x "*/\.*"

# Get file size
SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

echo ""
echo "=========================================="
echo "  ✓ Zip created!"
echo "=========================================="
echo ""
echo "File: $OUTPUT_FILE ($SIZE)"
echo ""
echo "Next steps:"
echo "1. Open Google Colab: https://colab.research.google.com"
echo "2. Upload the notebook: ml-models/Train_Vehicle_Model.ipynb"
echo "3. Upload the zip file when prompted"
echo "4. Run all cells!"
