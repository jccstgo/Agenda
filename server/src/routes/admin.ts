import express from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import db from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { UPLOADS_DIR } from '../config/env';
import {
  DEFAULT_SUPERADMIN_PASSWORD,
  DEFAULT_SUPERADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_READER_PASSWORD,
  DEFAULT_READER_USERNAME
} from '../config/env';
import { logAudit } from '../middleware/audit';

const router = express.Router();

// Solo accesible para administradores
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
  }
  next();
};

// Endpoint temporal: resetear contraseñas a valores por defecto de variables Railway
router.post('/users/reset-default-passwords', authenticateToken, requireAdmin, (req, res) => {
  try {
    const confirmation = req.body?.confirmation;

    if (confirmation !== 'RESET_DEFAULT_PASSWORDS') {
      return res.status(400).json({
        error: 'Confirmación inválida. Reintente la acción desde el botón de administración.'
      });
    }

    const targets = [
      {
        role: 'superadmin',
        preferredUsername: DEFAULT_SUPERADMIN_USERNAME,
        password: DEFAULT_SUPERADMIN_PASSWORD
      },
      {
        role: 'admin',
        preferredUsername: DEFAULT_ADMIN_USERNAME,
        password: DEFAULT_ADMIN_PASSWORD
      },
      {
        role: 'reader',
        preferredUsername: DEFAULT_READER_USERNAME,
        password: DEFAULT_READER_PASSWORD
      }
    ] as const;

    const findByUsernameAndRole = db.prepare(
      'SELECT id, username, role FROM users WHERE lower(username) = lower(?) AND role = ?'
    );
    const findFirstByRole = db.prepare('SELECT id, username, role FROM users WHERE role = ? ORDER BY id ASC LIMIT 1');
    const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    const hasLastPasswordChange = userColumns.some((column) => column.name === 'last_password_change');

    const updatePassword = hasLastPasswordChange
      ? db.prepare('UPDATE users SET password = ?, last_password_change = CURRENT_TIMESTAMP WHERE id = ?')
      : db.prepare('UPDATE users SET password = ? WHERE id = ?');

    const resolvedUsers = targets.map((target) => {
      const exact = findByUsernameAndRole.get(target.preferredUsername, target.role) as
        | { id: number; username: string; role: string }
        | undefined;

      if (exact) {
        return { ...exact, targetPassword: target.password };
      }

      const fallback = findFirstByRole.get(target.role) as
        | { id: number; username: string; role: string }
        | undefined;

      if (fallback) {
        return { ...fallback, targetPassword: target.password };
      }

      return null;
    });

    const missingRoles = targets
      .filter((_, index) => resolvedUsers[index] === null)
      .map((target) => target.role);

    if (missingRoles.length > 0) {
      return res.status(404).json({
        error: `No se encontraron usuarios para los roles: ${missingRoles.join(', ')}`
      });
    }

    const usersToUpdate = resolvedUsers.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const updateTransaction = db.transaction((users: typeof usersToUpdate) => {
      users.forEach((user) => {
        const hashedPassword = bcrypt.hashSync(user.targetPassword, 10);
        updatePassword.run(hashedPassword, user.id);
      });
    });

    updateTransaction(usersToUpdate);

    logAudit(req, {
      action: 'RESET_DEFAULT_PASSWORDS',
      resourceType: 'user',
      details: `Reseteó contraseñas por defecto Railway para usuarios: ${usersToUpdate
        .map((user) => `${user.username}(${user.role})`)
        .join(', ')}`
    });

    res.json({
      success: true,
      message: 'Contraseñas reseteadas a valores por defecto de Railway.',
      users: usersToUpdate.map((user) => ({
        id: user.id,
        username: user.username,
        role: user.role
      }))
    });
  } catch (error: any) {
    console.error('Error reseteando contraseñas por defecto:', error);
    res.status(500).json({ error: error.message });
  }
});

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
