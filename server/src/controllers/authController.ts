import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import {
  JWT_SECRET,
  DEFAULT_SUPERADMIN_USERNAME,
  DEFAULT_SUPERADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_READER_USERNAME,
  DEFAULT_READER_PASSWORD
} from '../config/env';

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

export const resetDefaultPasswordsFromLogin = (req: Request, res: Response) => {
  try {
    const confirmation = req.body?.confirmation;
    if (confirmation !== 'RESET_DEFAULT_PASSWORDS_FROM_LOGIN') {
      return res.status(400).json({
        error: 'Confirmación inválida para reset de credenciales.'
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
      'SELECT id, username, role, password FROM users WHERE lower(username) = lower(?) AND role = ?'
    );
    const findFirstByRole = db.prepare(
      'SELECT id, username, role, password FROM users WHERE role = ? ORDER BY id ASC LIMIT 1'
    );
    const findByUsername = db.prepare('SELECT id FROM users WHERE lower(username) = lower(?)');

    const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    const hasLastPasswordChange = userColumns.some((column) => column.name === 'last_password_change');

    const updatePassword = hasLastPasswordChange
      ? db.prepare('UPDATE users SET password = ?, last_password_change = CURRENT_TIMESTAMP WHERE id = ?')
      : db.prepare('UPDATE users SET password = ? WHERE id = ?');
    const insertUser = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');

    const getAvailableUsername = (preferred: string): string => {
      let username = preferred;
      let suffix = 1;

      while (findByUsername.get(username)) {
        username = `${preferred}-${suffix}`;
        suffix += 1;
      }

      return username;
    };

    const syncTransaction = db.transaction(() => {
      const affectedUsers: Array<{ id: number; username: string; role: string }> = [];

      targets.forEach((target) => {
        const exact = findByUsernameAndRole.get(target.preferredUsername, target.role) as
          | { id: number; username: string; role: string; password: string }
          | undefined;
        const byRole = findFirstByRole.get(target.role) as
          | { id: number; username: string; role: string; password: string }
          | undefined;

        let user = exact || byRole;

        if (!user) {
          const username = getAvailableUsername(target.preferredUsername);
          const hashedPassword = bcrypt.hashSync(target.password, 10);
          const insertResult = insertUser.run(username, hashedPassword, target.role);
          affectedUsers.push({
            id: Number(insertResult.lastInsertRowid),
            username,
            role: target.role
          });
          return;
        }

        const hashedPassword = bcrypt.hashSync(target.password, 10);
        updatePassword.run(hashedPassword, user.id);
        affectedUsers.push({
          id: user.id,
          username: user.username,
          role: user.role
        });
      });

      return affectedUsers;
    });

    const users = syncTransaction();

    res.json({
      success: true,
      message: 'Credenciales reseteadas a valores por defecto.',
      users
    });
  } catch (error) {
    console.error('Error reseteando credenciales desde login:', error);
    res.status(500).json({ error: 'No se pudieron resetear las credenciales.' });
  }
};
