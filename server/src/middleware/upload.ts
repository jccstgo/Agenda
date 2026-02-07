import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR } from '../config/env';

// Asegurar que el directorio de uploads existe
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tabId = req.params.tabId || 'general';
    const tabDir = path.join(UPLOADS_DIR, `tab-${tabId}`);

    if (!fs.existsSync(tabDir)) {
      fs.mkdirSync(tabDir, { recursive: true });
    }

    cb(null, tabDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `document-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB máximo
  }
});
