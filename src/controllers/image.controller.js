import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Image } from '../models/image.model.js';
import { generateThumbnail, getImageDimensions } from '../utils/thumbnail.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbnails');

const fsPromises = fs.promises;

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

    let tags = [];
    if (req.body.tags) {
      tags = req.body.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
    }

    const image = await Image.create({
      originalName: originalname,
      filename,
      mimetype,
      size,
      width,
      height,
      thumbnailFilename,
      description,
      tags,
    });

    return res.status(201).json(image);
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
      sortBy = 'uploadDate',
      sortOrder = 'desc',
    } = req.query;

    page = Number(page) || 1;
    limit = Math.min(Number(limit) || 10, 50);

    const query = {};

    if (search) {
      query.$text = { $search: search };
    }

    if (mimetype) {
      query.mimetype = mimetype;
    }

    const skip = (page - 1) * limit;

    const total = await Image.countDocuments(query);
    const pages = Math.ceil(total / limit);

    const images = await Image.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
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

    res.setHeader('Content-Type', image.mimetype);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${image.originalName}"`
    );

    return res.sendFile(filepath);
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

    res.setHeader('Content-Type', 'image/jpeg');

    return res.sendFile(thumbnailPath);
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

    // delete original
    try {
      await fsPromises.unlink(filepath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    // delete thumbnail
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