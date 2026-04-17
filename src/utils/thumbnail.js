import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');

/**
 * Generate thumbnail for uploaded image
 */
export async function generateThumbnail(filename) {
  // 1. Input path
  const inputPath = path.join(UPLOADS_DIR, filename);

  // 2. Thumbnail name (force .jpg)
  const thumbnailName = `thumb-${filename.replace(/\.\w+$/, '.jpg')}`;

  // 3. Output path
  const outputPath = path.join(THUMBNAILS_DIR, thumbnailName);

  // 4–6. Resize + convert + save
  await sharp(inputPath)
    .resize({
      width: 200,
      height: 200,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toFile(outputPath);

  // 7. Return filename
  return thumbnailName;
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(filepath) {
  // 1. Read metadata
  const metadata = await sharp(filepath).metadata();

  // 2–3. Return width & height
  return {
    width: metadata.width,
    height: metadata.height,
  };
}