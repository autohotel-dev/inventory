const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = path.join(__dirname, '../public/logo.png');
const DEST_DIR = path.join(__dirname, '../public/icons');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function generate() {
    console.log('Generating icons from:', SOURCE);

    if (!fs.existsSync(DEST_DIR)) {
        fs.mkdirSync(DEST_DIR, { recursive: true });
    }

    try {
        for (const size of SIZES) {
            let filename = `icon-${size}x${size}.png`;
            if (size === 192) filename = 'icon-192.png';
            if (size === 512) filename = 'icon-512.png';

            const dest = path.join(DEST_DIR, filename);
            await sharp(SOURCE)
                .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toFile(dest);
            console.log(`Generated ${filename}`);
        }

        // Maskable (usually needs safe zone, simple resize for now)
        await sharp(SOURCE)
            .resize(512, 512, { fit: 'contain', background: { r: 37, g: 99, b: 235, alpha: 1 } }) // Blue background for maskable? Or keep transparent? Maskable should be opaque usually.
            // Let's stick to transparent or white for safe bet if logo is irregular.
            // Actually, manifest theme_color is #2563eb (blue). Let's use that for background of maskable.
            .flatten({ background: '#2563eb' }) // Ensure no transparency for maskable
            .toFile(path.join(DEST_DIR, 'icon-maskable-512.png'));

        console.log('Generated icon-maskable-512.png');

    } catch (e) {
        console.error('Error:', e);
    }
}

generate();
