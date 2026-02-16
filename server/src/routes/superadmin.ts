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
const DELETED_USER_PREFIX = 'deleted-user-';

// Middleware para verificar que el usuario sea superadmin
const requireSuperAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo super administradores.' });
  }
  next();
};

const isReservedUsername = (username: string): boolean => {
  return username.toLowerCase().startsWith(DELETED_USER_PREFIX);
};

const getTabAssignmentsSnapshot = () => {
  const tabs = db.prepare('SELECT id, name, order_index FROM tabs ORDER BY order_index ASC, id ASC').all() as Array<{
    id: number;
    name: string;
    order_index: number;
  }>;

  const users = db
    .prepare(
      "SELECT id, username, role FROM users WHERE role = 'admin' AND lower(username) NOT LIKE lower(?) ORDER BY lower(username) ASC, id ASC"
    )
    .all(`${DELETED_USER_PREFIX}%`) as Array<{ id: number; username: string; role: 'admin' }>;

  const rows = db.prepare('SELECT tab_id, user_id FROM tab_user_permissions').all() as Array<{
    tab_id: number;
    user_id: number;
  }>;

  const userIdsByTab = new Map<number, number[]>();
  rows.forEach((entry) => {
    const bucket = userIdsByTab.get(entry.tab_id) || [];
    bucket.push(entry.user_id);
    userIdsByTab.set(entry.tab_id, bucket);
  });

  return {
    tabs: tabs.map((tab) => ({
      ...tab,
      userIds: (userIdsByTab.get(tab.id) || []).sort((a, b) => a - b)
    })),
    users
  };
};

// ========== GESTIÓN DE USUARIOS ==========

router.post('/users', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const rawUsername = req.body?.username;
    const rawPassword = req.body?.password;
    const rawRole = req.body?.role;

    const username = typeof rawUsername === 'string' ? rawUsername.trim() : '';
    const password = typeof rawPassword === 'string' ? rawPassword : '';
    const role = rawRole === 'reader' ? 'reader' : 'admin';

    if (!username) {
      return res.status(400).json({ error: 'El nombre de usuario es obligatorio.' });
    }

    if (username.length < 3 || username.length > 40) {
      return res.status(400).json({ error: 'El usuario debe tener entre 3 y 40 caracteres.' });
    }

    if (!/^[A-Za-z0-9._-]+$/.test(username)) {
      return res.status(400).json({ error: 'El usuario solo puede contener letras, números, punto, guion o guion bajo.' });
    }

    if (isReservedUsername(username)) {
      return res.status(400).json({ error: 'Nombre de usuario reservado. Elija otro nombre.' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    const existingUser = db
      .prepare('SELECT id FROM users WHERE lower(username) = lower(?)')
      .get(username) as { id: number } | undefined;

    if (existingUser) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese nombre.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const insertResult = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(
      username,
      hashedPassword,
      role
    );

    const createdUser = {
      id: Number(insertResult.lastInsertRowid),
      username,
      role
    };

    logAudit(req, {
      action: 'CREATE_USER',
      resourceType: 'user',
      resourceId: createdUser.id,
      resourceName: createdUser.username,
      details: `Creó usuario ${createdUser.username} con rol ${createdUser.role}`,
      statusCode: 201
    });

    res.status(201).json({
      success: true,
      message: `Usuario ${createdUser.username} creado correctamente.`,
      user: createdUser
    });
  } catch (error: any) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar nombre de usuario
router.put('/users/:userId', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const userId = Number.parseInt(req.params.userId, 10);
    const rawUsername = req.body?.username;
    const username = typeof rawUsername === 'string' ? rawUsername.trim() : '';

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    if (!username) {
      return res.status(400).json({ error: 'El nombre de usuario es obligatorio.' });
    }

    if (username.length < 3 || username.length > 40) {
      return res.status(400).json({ error: 'El usuario debe tener entre 3 y 40 caracteres.' });
    }

    if (!/^[A-Za-z0-9._-]+$/.test(username)) {
      return res.status(400).json({ error: 'El usuario solo puede contener letras, números, punto, guion o guion bajo.' });
    }

    if (isReservedUsername(username)) {
      return res.status(400).json({ error: 'Nombre de usuario reservado. Elija otro nombre.' });
    }

    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId) as
      | { id: number; username: string; role: 'superadmin' | 'admin' | 'reader' }
      | undefined;

    if (!user || isReservedUsername(user.username)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'No se permite modificar el nombre del super administrador.' });
    }

    const existingUser = db
      .prepare('SELECT id FROM users WHERE lower(username) = lower(?) AND id != ?')
      .get(username, userId) as { id: number } | undefined;

    if (existingUser) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese nombre.' });
    }

    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, userId);

    logAudit(req, {
      action: 'UPDATE_USER_USERNAME',
      resourceType: 'user',
      resourceId: userId,
      resourceName: username,
      details: `Cambió el usuario de "${user.username}" a "${username}"`,
      statusCode: 200
    });

    res.json({
      success: true,
      message: `Usuario actualizado a "${username}".`
    });
  } catch (error: any) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ error: error.message });
  }
});

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
    const findFirstByRole = db.prepare(
      'SELECT id, username, role FROM users WHERE role = ? AND lower(username) NOT LIKE lower(?) ORDER BY id ASC LIMIT 1'
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

    const syncUsersTransaction = db.transaction(() => {
      const affectedUsers: Array<{ id: number; username: string; role: string }> = [];

      targets.forEach((target) => {
        const exact = findByUsernameAndRole.get(target.preferredUsername, target.role) as
          | { id: number; username: string; role: string }
          | undefined;
        const byRole = findFirstByRole.get(target.role, `${DELETED_USER_PREFIX}%`) as
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
    const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    const hasLastPasswordChange = userColumns.some((column) => column.name === 'last_password_change');

    const users = db.prepare(`
      SELECT
        id,
        username,
        role,
        created_at,
        ${hasLastPasswordChange ? 'last_password_change' : 'created_at AS last_password_change'}
      FROM users
      WHERE lower(username) NOT LIKE lower(?)
      ORDER BY
        CASE role
          WHEN 'superadmin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'reader' THEN 3
        END,
        created_at
    `).all(`${DELETED_USER_PREFIX}%`);

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

// Eliminar usuario (borrado lógico para preservar auditoría)
router.delete('/users/:userId', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const userId = Number.parseInt(req.params.userId, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId) as
      | { id: number; username: string; role: 'superadmin' | 'admin' | 'reader' }
      | undefined;

    if (!user || isReservedUsername(user.username)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'No se puede eliminar un super administrador.' });
    }

    if (req.user?.userId === user.id) {
      return res.status(403).json({ error: 'No puede eliminar su propio usuario.' });
    }

    const deletedUsername = `${DELETED_USER_PREFIX}${user.id}-${Date.now()}`;
    const blockedPassword = bcrypt.hashSync(`${Date.now()}-${Math.random().toString(36).slice(2)}`, 10);

    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM tab_user_permissions WHERE user_id = ?').run(user.id);
      db.prepare('UPDATE documents SET uploaded_by = NULL WHERE uploaded_by = ?').run(user.id);
      db.prepare(`
        UPDATE users
        SET username = ?, password = ?, role = 'reader', last_password_change = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(deletedUsername, blockedPassword, user.id);
    });

    deleteTransaction();

    logAudit(req, {
      action: 'DELETE_USER',
      resourceType: 'user',
      resourceId: user.id,
      resourceName: user.username,
      details: `Eliminó al usuario ${user.username} (${user.role})`,
      statusCode: 200
    });

    res.json({
      success: true,
      message: `Usuario ${user.username} eliminado correctamente.`
    });
  } catch (error: any) {
    console.error('Error eliminando usuario:', error);
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

    if (!user || isReservedUsername(user.username)) {
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

    if (!user || isReservedUsername(user.username)) {
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

// ========== ASIGNACIÓN DE USUARIOS POR TEMA ==========

router.get('/tab-assignments', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const snapshot = getTabAssignmentsSnapshot();

    logAudit(req, {
      action: 'VIEW_TAB_ASSIGNMENTS',
      resourceType: 'tab',
      details: `Consultó asignaciones por tema (${snapshot.tabs.length} temas, ${snapshot.users.length} usuarios admin)`,
      statusCode: 200
    });

    res.json(snapshot);
  } catch (error: any) {
    console.error('Error obteniendo asignaciones por tema:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/tab-assignments', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const incomingAssignments = req.body?.assignments;
    if (!Array.isArray(incomingAssignments)) {
      return res.status(400).json({ error: 'Formato inválido. "assignments" debe ser un arreglo.' });
    }

    const existingTabs = db.prepare('SELECT id FROM tabs').all() as Array<{ id: number }>;
    const existingTabIds = new Set(existingTabs.map((tab) => tab.id));

    const adminUsers = db
      .prepare("SELECT id FROM users WHERE role = 'admin'")
      .all() as Array<{ id: number }>;
    const adminUserIds = new Set(adminUsers.map((user) => user.id));

    const seenTabs = new Set<number>();
    const normalized = incomingAssignments.map((entry: unknown) => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !('tabId' in entry) ||
        !('userIds' in entry) ||
        typeof (entry as { tabId: unknown }).tabId !== 'number' ||
        !Number.isInteger((entry as { tabId: number }).tabId) ||
        !Array.isArray((entry as { userIds: unknown }).userIds)
      ) {
        return null;
      }

      const tabId = (entry as { tabId: number }).tabId;
      if (!existingTabIds.has(tabId)) {
        return null;
      }

      if (seenTabs.has(tabId)) {
        return null;
      }
      seenTabs.add(tabId);

      const uniqueUserIds = Array.from(
        new Set(
          (entry as { userIds: unknown[] }).userIds
            .filter((value): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0)
        )
      );

      if (uniqueUserIds.some((id) => !adminUserIds.has(id))) {
        return null;
      }

      return {
        tabId,
        userIds: uniqueUserIds
      };
    });

    if (normalized.some((entry) => entry === null)) {
      return res.status(400).json({ error: 'Se detectaron asignaciones inválidas.' });
    }

    const validAssignments = normalized as Array<{ tabId: number; userIds: number[] }>;
    const userPairs = validAssignments.flatMap((assignment) =>
      assignment.userIds.map((userId) => ({
        tabId: assignment.tabId,
        userId
      }))
    );

    const replaceTransaction = db.transaction(() => {
      db.prepare('DELETE FROM tab_user_permissions').run();
      const insertStmt = db.prepare('INSERT INTO tab_user_permissions (tab_id, user_id) VALUES (?, ?)');
      userPairs.forEach((entry) => {
        insertStmt.run(entry.tabId, entry.userId);
      });
    });

    replaceTransaction();
    const snapshot = getTabAssignmentsSnapshot();

    logAudit(req, {
      action: 'UPDATE_TAB_ASSIGNMENTS',
      resourceType: 'tab',
      details: `Actualizó asignaciones por tema (${userPairs.length} permisos activos)`,
      statusCode: 200,
      extraContext: {
        permissionsCount: userPairs.length,
        assignedTabs: snapshot.tabs
          .filter((tab) => tab.userIds.length > 0)
          .map((tab) => ({ tabId: tab.id, userIds: tab.userIds }))
      }
    });

    res.json(snapshot);
  } catch (error: any) {
    console.error('Error actualizando asignaciones por tema:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ver todos los logs de auditoría
router.get('/audit-logs', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const {
      userId,
      action,
      httpMethod,
      endpoint,
      statusCode,
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

    if (httpMethod) {
      query += ' AND http_method = ?';
      params.push(httpMethod);
    }

    if (endpoint) {
      query += ' AND endpoint LIKE ?';
      params.push(`%${endpoint}%`);
    }

    if (statusCode) {
      query += ' AND status_code = ?';
      params.push(parseInt(statusCode as string));
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

    if (httpMethod) {
      countQuery += ' AND http_method = ?';
      countParams.push(httpMethod);
    }

    if (endpoint) {
      countQuery += ' AND endpoint LIKE ?';
      countParams.push(`%${endpoint}%`);
    }

    if (statusCode) {
      countQuery += ' AND status_code = ?';
      countParams.push(parseInt(statusCode as string));
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
