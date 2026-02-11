import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { logAudit } from '../middleware/audit';
import {
  DEFAULT_SUPERADMIN_USERNAME,
  DEFAULT_SUPERADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_READER_USERNAME,
  DEFAULT_READER_PASSWORD
} from '../config/env';

const router = express.Router();

// Middleware para verificar que el usuario sea superadmin
const requireSuperAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo super administradores.' });
  }
  next();
};

// ========== GESTIÓN DE USUARIOS ==========

// Resetear contraseñas por defecto (solo superadmin)
router.post('/users/reset-default-passwords', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const confirmation = req.body?.confirmation;
    if (confirmation !== 'RESET_DEFAULT_PASSWORDS_SUPERADMIN') {
      return res.status(400).json({ error: 'Confirmación inválida.' });
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

    const syncUsersTransaction = db.transaction(() => {
      const affectedUsers: Array<{ id: number; username: string; role: string }> = [];

      targets.forEach((target) => {
        const exact = findByUsernameAndRole.get(target.preferredUsername, target.role) as
          | { id: number; username: string; role: string }
          | undefined;
        const byRole = findFirstByRole.get(target.role) as
          | { id: number; username: string; role: string }
          | undefined;
        const user = exact || byRole;

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

    const users = syncUsersTransaction();

    logAudit(req, {
      action: 'RESET_DEFAULT_PASSWORDS',
      resourceType: 'user',
      details: `Reseteó contraseñas por defecto: ${users.map((user) => `${user.username}(${user.role})`).join(', ')}`
    });

    res.json({
      success: true,
      message: 'Contraseñas reseteadas a los valores por defecto de Railway.',
      users
    });
  } catch (error: any) {
    console.error('Error reseteando contraseñas por defecto (superadmin):', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar todos los usuarios
router.get('/users', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT
        id,
        username,
        role,
        created_at,
        last_password_change
      FROM users
      ORDER BY
        CASE role
          WHEN 'superadmin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'reader' THEN 3
        END,
        created_at
    `).all();

    logAudit(req, {
      action: 'VIEW_ALL_USERS',
      details: `Consultó la lista de todos los usuarios (${users.length} usuarios)`
    });

    res.json({ users });
  } catch (error: any) {
    console.error('Error listando usuarios:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cambiar contraseña de cualquier usuario
router.post('/users/:userId/change-password', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // Obtener información del usuario
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId) as any;

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // No permitir cambiar la contraseña de otro superadmin
    if (user.role === 'superadmin' && user.id !== req.user?.userId) {
      return res.status(403).json({ error: 'No se puede cambiar la contraseña de otro super administrador' });
    }

    // Hashear nueva contraseña
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    // Actualizar contraseña
    db.prepare(`
      UPDATE users
      SET password = ?, last_password_change = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(hashedPassword, userId);

    logAudit(req, {
      action: 'CHANGE_USER_PASSWORD',
      resourceType: 'user',
      resourceId: parseInt(userId),
      resourceName: user.username,
      details: `Cambió la contraseña del usuario ${user.username} (${user.role})`
    });

    res.json({
      success: true,
      message: `Contraseña actualizada para ${user.username}`
    });
  } catch (error: any) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cambiar rol de un usuario
router.post('/users/:userId/change-role', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const { newRole } = req.body;

    if (!['admin', 'reader'].includes(newRole)) {
      return res.status(400).json({ error: 'Rol inválido. Debe ser "admin" o "reader"' });
    }

    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId) as any;

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'No se puede cambiar el rol de un super administrador' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, userId);

    logAudit(req, {
      action: 'CHANGE_USER_ROLE',
      resourceType: 'user',
      resourceId: parseInt(userId),
      resourceName: user.username,
      details: `Cambió el rol de ${user.username} de "${user.role}" a "${newRole}"`
    });

    res.json({
      success: true,
      message: `Rol actualizado para ${user.username}: ${newRole}`
    });
  } catch (error: any) {
    console.error('Error cambiando rol:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== LOGS DE AUDITORÍA ==========

// Ver todos los logs de auditoría
router.get('/audit-logs', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const {
      userId,
      action,
      startDate,
      endDate,
      limit = '100',
      offset = '0'
    } = req.query;

    let query = `
      SELECT * FROM audit_logs
      WHERE 1=1
    `;
    const params: any[] = [];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    if (startDate) {
      query += ' AND timestamp_utc >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND timestamp_utc <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY timestamp_utc DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const logs = db.prepare(query).all(...params);

    // Contar total de registros
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams: any[] = [];

    if (userId) {
      countQuery += ' AND user_id = ?';
      countParams.push(userId);
    }

    if (action) {
      countQuery += ' AND action = ?';
      countParams.push(action);
    }

    const { total } = db.prepare(countQuery).get(...countParams) as any;

    logAudit(req, {
      action: 'VIEW_AUDIT_LOGS',
      details: `Consultó ${logs.length} registros de auditoría`
    });

    res.json({
      logs,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error: any) {
    console.error('Error obteniendo logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ver actividad de un usuario específico
router.get('/audit-logs/user/:userId', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = '50' } = req.query;

    const user = db.prepare('SELECT username, role FROM users WHERE id = ?').get(userId) as any;

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const logs = db.prepare(`
      SELECT * FROM audit_logs
      WHERE user_id = ?
      ORDER BY timestamp_utc DESC
      LIMIT ?
    `).all(userId, parseInt(limit as string));

    logAudit(req, {
      action: 'VIEW_USER_ACTIVITY',
      resourceType: 'user',
      resourceId: parseInt(userId),
      resourceName: user.username,
      details: `Consultó la actividad del usuario ${user.username}`
    });

    res.json({
      user,
      logs,
      total: logs.length
    });
  } catch (error: any) {
    console.error('Error obteniendo actividad de usuario:', error);
    res.status(500).json({ error: error.message });
  }
});

// Estadísticas de actividad
router.get('/audit-logs/stats', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    // Acciones más comunes
    const topActions = db.prepare(`
      SELECT
        action,
        COUNT(*) as count
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `).all();

    // Usuarios más activos
    const topUsers = db.prepare(`
      SELECT
        al.user_id,
        al.username,
        u.role,
        COUNT(*) as actions_count
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      GROUP BY al.user_id, al.username, u.role
      ORDER BY actions_count DESC
      LIMIT 10
    `).all();

    // Actividad por día (últimos 7 días)
    const dailyActivity = db.prepare(`
      SELECT
        DATE(timestamp_utc) as date,
        COUNT(*) as count
      FROM audit_logs
      WHERE timestamp_utc >= datetime('now', '-7 days')
      GROUP BY DATE(timestamp_utc)
      ORDER BY date DESC
    `).all();

    // Total de logs
    const { total } = db.prepare('SELECT COUNT(*) as total FROM audit_logs').get() as any;

    logAudit(req, {
      action: 'VIEW_AUDIT_STATS',
      details: 'Consultó las estadísticas de auditoría'
    });

    res.json({
      total,
      topActions,
      topUsers,
      dailyActivity
    });
  } catch (error: any) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
