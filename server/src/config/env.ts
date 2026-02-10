import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const resolvePath = (rawPath: string, fallbackAbsolutePath: string): string => {
  if (!rawPath?.trim()) {
    return fallbackAbsolutePath;
  }

  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
};

const requireStrongPassword = (password: string, label: string): void => {
  const hasMinLength = password.length >= 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!hasMinLength || !hasUpper || !hasLower || !hasNumber || !hasSymbol) {
    throw new Error(
      `${label} debe tener al menos 12 caracteres e incluir mayúsculas, minúsculas, números y símbolos.`
    );
  }
};

const jwtSecretFromEnv = process.env.JWT_SECRET?.trim();

if (IS_PRODUCTION && (!jwtSecretFromEnv || jwtSecretFromEnv.length < 32)) {
  throw new Error('En producción, JWT_SECRET es obligatorio y debe tener al menos 32 caracteres.');
}

export const JWT_SECRET =
  jwtSecretFromEnv && jwtSecretFromEnv.length > 0
    ? jwtSecretFromEnv
    : 'dev-only-jwt-secret-change-me-for-production';

if (!IS_PRODUCTION && JWT_SECRET === 'dev-only-jwt-secret-change-me-for-production') {
  console.warn('Advertencia: JWT_SECRET no configurado, se usa un secreto inseguro solo para desarrollo.');
}

const superadminUsername = process.env.DEFAULT_SUPERADMIN_USERNAME?.trim() || 'superadmin';
const adminUsername = process.env.DEFAULT_ADMIN_USERNAME?.trim() || 'admin';
const readerUsername = process.env.DEFAULT_READER_USERNAME?.trim() || 'Director';
const superadminPasswordFromEnv = process.env.DEFAULT_SUPERADMIN_PASSWORD?.trim();
const adminPasswordFromEnv = process.env.DEFAULT_ADMIN_PASSWORD?.trim();
const readerPasswordFromEnv = process.env.DEFAULT_READER_PASSWORD?.trim();
export const HAS_SUPERADMIN_PASSWORD_FROM_ENV = Boolean(superadminPasswordFromEnv);
export const HAS_ADMIN_PASSWORD_FROM_ENV = Boolean(adminPasswordFromEnv);
export const HAS_READER_PASSWORD_FROM_ENV = Boolean(readerPasswordFromEnv);

export const DEFAULT_SUPERADMIN_USERNAME = superadminUsername;
export const DEFAULT_ADMIN_USERNAME = adminUsername;
export const DEFAULT_READER_USERNAME = readerUsername;
export const DEFAULT_SUPERADMIN_PASSWORD = superadminPasswordFromEnv || 'superadmin123';
export const DEFAULT_ADMIN_PASSWORD = adminPasswordFromEnv || 'admin123';
export const DEFAULT_READER_PASSWORD = readerPasswordFromEnv || 'director123';

if (IS_PRODUCTION && HAS_SUPERADMIN_PASSWORD_FROM_ENV) {
  requireStrongPassword(DEFAULT_SUPERADMIN_PASSWORD, 'DEFAULT_SUPERADMIN_PASSWORD');
}

if (IS_PRODUCTION && HAS_ADMIN_PASSWORD_FROM_ENV) {
  requireStrongPassword(DEFAULT_ADMIN_PASSWORD, 'DEFAULT_ADMIN_PASSWORD');
}

if (IS_PRODUCTION && HAS_READER_PASSWORD_FROM_ENV) {
  requireStrongPassword(DEFAULT_READER_PASSWORD, 'DEFAULT_READER_PASSWORD');
}

const defaultDbPath = path.resolve(process.cwd(), 'database.sqlite');
const defaultUploadsPath = path.resolve(process.cwd(), '../uploads');

export const DB_PATH = resolvePath(process.env.DB_PATH || '', defaultDbPath);
export const UPLOADS_DIR = resolvePath(process.env.UPLOADS_DIR || '', defaultUploadsPath);
