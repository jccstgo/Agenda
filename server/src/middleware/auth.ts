import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    userId: number;
    username: string;
    role: 'superadmin' | 'admin' | 'reader';
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: 'superadmin' | 'admin' | 'reader' };
    req.user = {
      ...decoded,
      userId: decoded.id
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};

export const authenticateTokenFromQuery = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Intentar obtener el token del header primero
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  // Si no está en el header, intentar obtenerlo del query string
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: 'superadmin' | 'admin' | 'reader' };
    req.user = {
      ...decoded,
      userId: decoded.id
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Superadmin también tiene acceso a todo lo que requiere admin
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador' });
  }
  next();
};
