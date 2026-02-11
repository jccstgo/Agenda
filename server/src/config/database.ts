import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import {
  DB_PATH,
  DEFAULT_SUPERADMIN_PASSWORD,
  DEFAULT_SUPERADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_READER_PASSWORD,
  DEFAULT_READER_USERNAME,
  HAS_SUPERADMIN_PASSWORD_FROM_ENV,
  HAS_ADMIN_PASSWORD_FROM_ENV,
  HAS_READER_PASSWORD_FROM_ENV,
  IS_PRODUCTION
} from './env';

const db = new Database(DB_PATH);
const LEGACY_ADMIN_PASSWORD = 'admin123';
const LEGACY_READER_USERNAME = 'lector';
const LEGACY_READER_PASSWORD = 'lector123';
const LEGACY_DIRECTOR_PASSWORD = 'director123';

// Habilitar foreign keys
db.pragma('foreign_keys = ON');

// Inicializar tablas
export const initDatabase = () => {
  // Tabla de usuarios
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin', 'reader')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_password_change DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migración: asegurar columna last_password_change en instalaciones antiguas
  const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{
    name: string;
  }>;
  const hasLastPasswordChange = userColumns.some((column) => column.name === 'last_password_change');

  if (!hasLastPasswordChange) {
    db.exec('ALTER TABLE users ADD COLUMN last_password_change DATETIME');
    db.exec("UPDATE users SET last_password_change = CURRENT_TIMESTAMP WHERE last_password_change IS NULL");
    console.log('✓ Migración aplicada: columna users.last_password_change agregada');
  }

  // Tabla de auditoría de acciones
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id INTEGER,
      resource_name TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      timestamp_utc DATETIME DEFAULT CURRENT_TIMESTAMP,
      timestamp_cdmx TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Crear índices para búsquedas rápidas
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp_utc);
  `);

  // Tabla de pestañas/temas
  db.exec(`
    CREATE TABLE IF NOT EXISTS tabs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de documentos
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tab_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      uploaded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  // Insertar usuarios por defecto si no existen
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

  if (userCount.count === 0) {
    if (IS_PRODUCTION && (!HAS_SUPERADMIN_PASSWORD_FROM_ENV || !HAS_ADMIN_PASSWORD_FROM_ENV || !HAS_READER_PASSWORD_FROM_ENV)) {
      throw new Error(
        'En producción y con base vacía, define DEFAULT_SUPERADMIN_PASSWORD, DEFAULT_ADMIN_PASSWORD y DEFAULT_READER_PASSWORD antes de iniciar.'
      );
    }

    const superadminPassword = bcrypt.hashSync(DEFAULT_SUPERADMIN_PASSWORD, 10);
    const adminPassword = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10);
    const readerPassword = bcrypt.hashSync(DEFAULT_READER_PASSWORD, 10);

    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(
      DEFAULT_SUPERADMIN_USERNAME,
      superadminPassword,
      'superadmin'
    );
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(
      DEFAULT_ADMIN_USERNAME,
      adminPassword,
      'admin'
    );
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(
      DEFAULT_READER_USERNAME,
      readerPassword,
      'reader'
    );

    console.log('✓ Usuarios por defecto creados (superadmin, admin, reader)');
  }

  // Migración: asegurar que exista un superadmin utilizable y sincronizado con variables Railway
  const findUserByUsername = db.prepare('SELECT id FROM users WHERE lower(username) = lower(?)');
  const findFirstSuperadmin = db.prepare(
    'SELECT id, username, password FROM users WHERE role = ? ORDER BY id ASC LIMIT 1'
  );

  let superadminUser = findFirstSuperadmin.get('superadmin') as
    | { id: number; username: string; password: string }
    | undefined;

  if (!superadminUser) {
    let candidateUsername = DEFAULT_SUPERADMIN_USERNAME;
    let suffix = 1;

    while (findUserByUsername.get(candidateUsername)) {
      candidateUsername = `${DEFAULT_SUPERADMIN_USERNAME}-${suffix}`;
      suffix += 1;
    }

    const createdPassword = bcrypt.hashSync(DEFAULT_SUPERADMIN_PASSWORD, 10);
    const insertResult = db
      .prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
      .run(candidateUsername, createdPassword, 'superadmin');

    superadminUser = {
      id: Number(insertResult.lastInsertRowid),
      username: candidateUsername,
      password: createdPassword
    };

    console.log(`✓ Superadmin recreado automáticamente con usuario "${candidateUsername}"`);
  }

  // Si el username por defecto está libre, lo normalizamos al nombre esperado para acceso predecible
  if (
    superadminUser.username.toLowerCase() !== DEFAULT_SUPERADMIN_USERNAME.toLowerCase() &&
    !findUserByUsername.get(DEFAULT_SUPERADMIN_USERNAME)
  ) {
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(DEFAULT_SUPERADMIN_USERNAME, superadminUser.id);
    superadminUser = {
      ...superadminUser,
      username: DEFAULT_SUPERADMIN_USERNAME
    };
    console.log(`✓ Usuario superadmin normalizado a "${DEFAULT_SUPERADMIN_USERNAME}"`);
  }

  // Si Railway define password para superadmin, lo sincronizamos para asegurar acceso
  if (HAS_SUPERADMIN_PASSWORD_FROM_ENV && !bcrypt.compareSync(DEFAULT_SUPERADMIN_PASSWORD, superadminUser.password)) {
    db.prepare('UPDATE users SET password = ?, last_password_change = CURRENT_TIMESTAMP WHERE id = ?').run(
      bcrypt.hashSync(DEFAULT_SUPERADMIN_PASSWORD, 10),
      superadminUser.id
    );
    console.log('✓ Contraseña de superadmin sincronizada con DEFAULT_SUPERADMIN_PASSWORD');
  }

  // Migración: renombrar usuario legado "lector" a "Director" si no existe aún
  const existingDirector = db
    .prepare('SELECT id FROM users WHERE lower(username) = lower(?)')
    .get(DEFAULT_READER_USERNAME) as { id: number } | undefined;

  if (!existingDirector) {
    const legacyReader = db
      .prepare('SELECT id, password FROM users WHERE lower(username) = lower(?) AND role = ?')
      .get(LEGACY_READER_USERNAME, 'reader') as { id: number; password: string } | undefined;

    if (legacyReader) {
      const shouldRotatePassword = bcrypt.compareSync(LEGACY_READER_PASSWORD, legacyReader.password);
      const nextPassword = shouldRotatePassword
        ? bcrypt.hashSync(DEFAULT_READER_PASSWORD, 10)
        : legacyReader.password;

      db.prepare('UPDATE users SET username = ?, password = ? WHERE id = ?').run(
        DEFAULT_READER_USERNAME,
        nextPassword,
        legacyReader.id
      );
      console.log('✓ Usuario "lector" migrado a "Director"');
    }
  }

  // Migración de seguridad: rotar contraseñas por defecto en producción si se definieron nuevas contraseñas fuertes
  if (IS_PRODUCTION && HAS_ADMIN_PASSWORD_FROM_ENV) {
    const adminUser = db
      .prepare('SELECT id, password FROM users WHERE lower(username) = lower(?) AND role = ?')
      .get(DEFAULT_ADMIN_USERNAME, 'admin') as { id: number; password: string } | undefined;

    if (adminUser && bcrypt.compareSync(LEGACY_ADMIN_PASSWORD, adminUser.password)) {
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(
        bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10),
        adminUser.id
      );
      console.log('✓ Contraseña de admin actualizada desde valor por defecto');
    }
  }

  if (IS_PRODUCTION && HAS_READER_PASSWORD_FROM_ENV) {
    const readerUser = db
      .prepare('SELECT id, password FROM users WHERE lower(username) = lower(?) AND role = ?')
      .get(DEFAULT_READER_USERNAME, 'reader') as { id: number; password: string } | undefined;

    if (
      readerUser &&
      (bcrypt.compareSync(LEGACY_DIRECTOR_PASSWORD, readerUser.password) ||
        bcrypt.compareSync(LEGACY_READER_PASSWORD, readerUser.password))
    ) {
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(
        bcrypt.hashSync(DEFAULT_READER_PASSWORD, 10),
        readerUser.id
      );
      console.log('✓ Contraseña de Director actualizada desde valor por defecto');
    }
  }

  // Insertar pestañas por defecto si no existen
  const tabCount = db.prepare('SELECT COUNT(*) as count FROM tabs').get() as { count: number };

  if (tabCount.count === 0) {
    const tabs = [
      { name: 'Apertura', order: 1 },
      { name: 'Tema 1 - Planeación Conjunta', order: 2 },
      { name: 'Tema 2 - Logística Operacional', order: 3 },
      { name: 'Tema 3 - Derechos Humanos', order: 4 },
      { name: 'Tema 4 - Pensamiento Estratégico', order: 5 },
      { name: 'Documentos de Apoyo', order: 6 },
      { name: 'Directorio', order: 7 }
    ];

    const insertTab = db.prepare('INSERT INTO tabs (name, order_index) VALUES (?, ?)');
    tabs.forEach(tab => insertTab.run(tab.name, tab.order));

    console.log('✓ Pestañas por defecto creadas');
  }

  console.log('✓ Base de datos inicializada correctamente');
};

export default db;
