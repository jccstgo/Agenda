import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import { JWT_SECRET } from '../config/env';
import { logAudit } from '../middleware/audit';
import { AuthRequest } from '../middleware/auth';

interface User {
  id: number;
  username: string;
  password: string;
  role: string;
}

export const login = (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    // Buscar usuario
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar contraseña
    const validPassword = bcrypt.compareSync(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

export const verifyToken = (req: Request, res: Response) => {
  res.json({ valid: true });
};

export const changeOwnPassword = (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !role) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    if (role !== 'admin' && role !== 'reader') {
      return res.status(403).json({ error: 'Acción permitida solo para Administrador o Director.' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'La contraseña actual y la nueva son obligatorias.' });
    }

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Formato de contraseña inválido.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual.' });
    }

    const user = db.prepare('SELECT id, username, role, password FROM users WHERE id = ?').get(userId) as
      | { id: number; username: string; role: 'superadmin' | 'admin' | 'reader'; password: string }
      | undefined;

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const isCurrentPasswordValid = bcrypt.compareSync(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }

    const nextPasswordHash = bcrypt.hashSync(newPassword, 10);
    const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    const hasLastPasswordChange = userColumns.some((column) => column.name === 'last_password_change');

    if (hasLastPasswordChange) {
      db.prepare('UPDATE users SET password = ?, last_password_change = CURRENT_TIMESTAMP WHERE id = ?').run(
        nextPasswordHash,
        userId
      );
    } else {
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(nextPasswordHash, userId);
    }

    logAudit(req, {
      action: 'CHANGE_OWN_PASSWORD',
      resourceType: 'user',
      resourceId: user.id,
      resourceName: user.username,
      details: `Cambió su propia contraseña (${user.role})`,
      statusCode: 200
    });

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente.'
    });
  } catch (error: any) {
    console.error('Error cambiando contraseña propia:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
};
