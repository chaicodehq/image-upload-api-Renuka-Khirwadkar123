import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Image } from '../models/image.model.js';
import { generateThumbnail, getImageDimensions } from '../utils/thumbnail.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbnails');

const fsPromises = fs.promises;

// FIX 1: Ensure upload and thumbnail directories exist on startup
await fsPromises.mkdir(UPLOAD_DIR, { recursive: true });
await fsPromises.mkdir(THUMB_DIR, { recursive: true });

const ALLOWED_SORT_FIELDS = ['uploadDate', 'size', 'width', 'height', 'originalName', 'mimetype'];

function parseTags(input) {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .map(tag => String(tag).trim())
      .filter(Boolean)
      .slice(0, 50);
  }

  if (typeof input === 'string') {
    return input
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)
      .slice(0, 50);
  }

  return [];
}

// FIX 2: Safe Content-Disposition header using RFC 5987 encoding
function contentDisposition(filename) {
  const encoded = encodeURIComponent(filename).replace(/'/g, '%27');
  return `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`;
}

/**
 * Upload image
 */
export async function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No file uploaded' } });
    }

    const { filename, originalname, mimetype, size } = req.file;
    const filepath = path.join(UPLOAD_DIR, filename);

    const { width, height } = await getImageDimensions(filepath);
    const thumbnailFilename = await generateThumbnail(filename);

    const description = req.body.description || '';
    const tags = parseTags(req.body.tags);

    // FIX 3: Warn caller if tags were truncated
    const rawTags = parseTags(req.body.tags);
    const inputTagCount = Array.isArray(req.body.tags)
      ? req.body.tags.length
      : (req.body.tags || '').split(',').length;
    const tagsWereTruncated = inputTagCount > 50;

    const image = await Image.create({
      originalName: originalname,
      filename,
      mimetype,
      size,
      width,
      height,
      thumbnailFilename,
      description,
      tags: rawTags,
    });

    return res.status(201).json({
      ...image.toObject(),
      ...(tagsWereTruncated && { warning: 'Tags were truncated to 50 maximum' }),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List images
 */
export async function listImages(req, res, next) {
  try {
    let {
      page = 1,
      limit = 10,
      search,
      mimetype,
      tags,                         // FIX 4: Added tag filtering support
      sortBy = 'uploadDate',
      sortOrder = 'desc',
    } = req.query;

    page = Math.max(Number(page) || 1, 1);
    limit = Math.min(Math.max(Number(limit) || 10, 1), 50);

    sortBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'uploadDate';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const query = {};

    if (search) {
      query.$text = { $search: search };
    }

    if (mimetype) {
      query.mimetype = mimetype;
    }

    // FIX 4: Filter by tags if provided
    if (tags) {
      const tagList = parseTags(tags);
      if (tagList.length > 0) {
        query.tags = { $all: tagList };
      }
    }

    const total = await Image.countDocuments(query);
    const pages = Math.ceil(total / limit);

    // FIX 5: Skip DB query if no results
    if (total === 0) {
      return res.status(200).json({
        data: [],
        meta: { total: 0, page, limit, pages: 0, totalSize: 0 },
      });
    }

    const skip = (page - 1) * limit;

    const images = await Image.find(query)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit);

    const totalSizeAgg = await Image.aggregate([
      { $match: query },
      { $group: { _id: null, totalSize: { $sum: '$size' } } },
    ]);

    const totalSize = totalSizeAgg[0]?.totalSize || 0;

    return res.status(200).json({
      data: images,
      meta: {
        total,
        page,
        limit,
        pages,
        totalSize,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get image metadata
 */
export async function getImage(req, res, next) {
  try {
    const image = await Image.findById(req.params.id);

    if (!image) {
      return res.status(404).json({
        error: { message: 'Image not found' },
      });
    }

    return res.status(200).json(image);
  } catch (error) {
    next(error);
  }
}

/**
 * Download original image
 */
export async function downloadImage(req, res, next) {
  try {
    const image = await Image.findById(req.params.id);

    if (!image) {
      return res.status(404).json({
        error: { message: 'Image not found' },
      });
    }

    const filepath = path.join(UPLOAD_DIR, image.filename);

    try {
      await fsPromises.access(filepath);
    } catch {
      return res.status(404).json({
        error: { message: 'File not found' },
      });
    }

    const fileStats = await fsPromises.stat(filepath);

    res.setHeader('Content-Type', image.mimetype);
    res.setHeader('Content-Length', fileStats.size);
    // FIX 2: Safe Content-Disposition header
    res.setHeader('Content-Disposition', contentDisposition(image.originalName));

    // FIX 6: Pass error callback to sendFile
    return res.sendFile(filepath, (err) => {
      if (err) next(err);
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Download thumbnail
 */
export async function downloadThumbnail(req, res, next) {
  try {
    const image = await Image.findById(req.params.id);

    if (!image) {
      return res.status(404).json({
        error: { message: 'Image not found' },
      });
    }

    const thumbnailPath = path.join(THUMB_DIR, image.thumbnailFilename);

    try {
      await fsPromises.access(thumbnailPath);
    } catch {
      return res.status(404).json({
        error: { message: 'File not found' },
      });
    }

    const thumbnailStats = await fsPromises.stat(thumbnailPath);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', thumbnailStats.size);

    // FIX 6: Pass error callback to sendFile
    return res.sendFile(thumbnailPath, (err) => {
      if (err) next(err);
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete image
 */
export async function deleteImage(req, res, next) {
  try {
    const image = await Image.findById(req.params.id);

    if (!image) {
      return res.status(404).json({
        error: { message: 'Image not found' },
      });
    }

    const filepath = path.join(UPLOAD_DIR, image.filename);
    const thumbnailPath = path.join(THUMB_DIR, image.thumbnailFilename);

    try {
      await fsPromises.unlink(filepath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    try {
      await fsPromises.unlink(thumbnailPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    await Image.findByIdAndDelete(req.params.id);

    return res.sendStatus(204);
  } catch (error) {
    next(error);
  }
}