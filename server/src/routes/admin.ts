import express from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateToken } from '../middleware/auth';
import { UPLOADS_DIR } from '../config/env';

const router = express.Router();

// Solo accesible para administradores
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
  }
  next();
};

// Listar contenido del volumen
router.get('/volume/files', authenticateToken, requireAdmin, (req, res) => {
  try {
    const listDirectory = (dirPath: string, relativePath: string = ''): any => {
      if (!fs.existsSync(dirPath)) {
        return null;
      }

      const items = fs.readdirSync(dirPath);
      const result: any = {
        path: relativePath || '/',
        files: [],
        directories: []
      };

      items.forEach(item => {
        const fullPath = path.join(dirPath, item);
        const stats = fs.statSync(fullPath);
        const itemInfo = {
          name: item,
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime
        };

        if (stats.isDirectory()) {
          result.directories.push({
            ...itemInfo,
            contents: listDirectory(fullPath, path.join(relativePath, item))
          });
        } else {
          result.files.push(itemInfo);
        }
      });

      return result;
    };

    const volumeContents = listDirectory(UPLOADS_DIR);

    res.json({
      uploadsDir: UPLOADS_DIR,
      contents: volumeContents,
      totalFiles: volumeContents ? countFiles(volumeContents) : 0
    });
  } catch (error: any) {
    console.error('Error listando archivos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Función auxiliar para contar archivos
const countFiles = (dir: any): number => {
  let count = dir.files.length;
  dir.directories.forEach((subdir: any) => {
    if (subdir.contents) {
      count += countFiles(subdir.contents);
    }
  });
  return count;
};

// Obtener estadísticas del volumen
router.get('/volume/stats', authenticateToken, requireAdmin, (req, res) => {
  try {
    const getDirectorySize = (dirPath: string): number => {
      if (!fs.existsSync(dirPath)) return 0;

      let totalSize = 0;
      const items = fs.readdirSync(dirPath);

      items.forEach(item => {
        const fullPath = path.join(dirPath, item);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          totalSize += getDirectorySize(fullPath);
        } else {
          totalSize += stats.size;
        }
      });

      return totalSize;
    };

    const totalSize = getDirectorySize(UPLOADS_DIR);
    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
    const sizeInGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);

    res.json({
      uploadsDir: UPLOADS_DIR,
      totalSize,
      sizeInMB: `${sizeInMB} MB`,
      sizeInGB: `${sizeInGB} GB`,
      exists: fs.existsSync(UPLOADS_DIR)
    });
  } catch (error: any) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar solo archivos de una pestaña específica
router.get('/volume/tab/:tabId', authenticateToken, requireAdmin, (req, res) => {
  try {
    const tabId = req.params.tabId;
    const tabDir = path.join(UPLOADS_DIR, `tab-${tabId}`);

    if (!fs.existsSync(tabDir)) {
      return res.json({
        tabId,
        path: tabDir,
        files: [],
        message: 'Directorio no existe aún'
      });
    }

    const files = fs.readdirSync(tabDir).map(file => {
      const filePath = path.join(tabDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        sizeInMB: (stats.size / (1024 * 1024)).toFixed(2),
        modified: stats.mtime,
        created: stats.birthtime
      };
    });

    res.json({
      tabId,
      path: tabDir,
      files,
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0)
    });
  } catch (error: any) {
    console.error('Error listando archivos de pestaña:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
