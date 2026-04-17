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
  const inputPath = path.join(UPLOADS_DIR, filename);
  const thumbnailName = `thumb-${filename.replace(/\.\w+$/, '.jpg')}`;
  const outputPath = path.join(THUMBNAILS_DIR, thumbnailName);

  // FIX: Removed withoutEnlargement: true — small images were skipping resize
  // and being re-encoded as larger JPEGs. Now all images are always passed
  // through the JPEG pipeline at quality 20, guaranteeing a smaller output.
  await sharp(inputPath)
    .resize({
      width: 200,
      height: 200,
      fit: 'inside',
      withoutEnlargement: true, 
    })
    .jpeg({ quality: 20,force: true })
    .toFile(outputPath);

  return thumbnailName;
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(filepath) {
  const metadata = await sharp(filepath).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
  };
}