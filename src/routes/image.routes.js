import { Router } from 'express';
import multer from 'multer';
import {
  uploadImage,
  listImages,
  getImage,
  downloadImage,
  downloadThumbnail,
  deleteImage,
} from '../controllers/image.controller.js';
import { upload } from '../middlewares/upload.middleware.js';
import { validateObjectId } from '../middlewares/validateObjectId.middleware.js';

const router = Router();

// FIX: Wrap upload.single() in a callback to properly forward multer errors to errorHandler
router.post('/', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, uploadImage);

router.get('/', listImages);

router.get('/:id', validateObjectId, getImage);

router.get('/:id/download', validateObjectId, downloadImage);

router.get('/:id/thumbnail', validateObjectId, downloadThumbnail);

router.delete('/:id', validateObjectId, deleteImage);

export default router;