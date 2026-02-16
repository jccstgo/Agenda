import db from '../config/database';

type AuthUserLike =
  | {
      userId: number;
      role: 'superadmin' | 'admin' | 'reader';
    }
  | undefined;

export const hasTabAssignmentsConfigured = (): boolean => {
  const result = db
    .prepare('SELECT COUNT(*) as count FROM tab_user_permissions')
    .get() as { count: number };
  return result.count > 0;
};

export const canUserManageTab = (user: AuthUserLike, tabId: number): boolean => {
  if (!user) {
    return false;
  }

  if (user.role === 'superadmin') {
    return true;
  }

  if (user.role !== 'admin') {
    return false;
  }

  // Compatibilidad hacia atrás: si no hay asignaciones configuradas todavía,
  // admins conservan acceso global.
  if (!hasTabAssignmentsConfigured()) {
    return true;
  }

  const exists = db
    .prepare('SELECT 1 FROM tab_user_permissions WHERE tab_id = ? AND user_id = ? LIMIT 1')
    .get(tabId, user.userId);
  return Boolean(exists);
};
