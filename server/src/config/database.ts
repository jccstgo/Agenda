import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import {
  DB_PATH,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_READER_PASSWORD,
  DEFAULT_READER_USERNAME,
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
      role TEXT NOT NULL CHECK(role IN ('admin', 'reader')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
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
    if (IS_PRODUCTION && (!HAS_ADMIN_PASSWORD_FROM_ENV || !HAS_READER_PASSWORD_FROM_ENV)) {
      throw new Error(
        'En producción y con base vacía, define DEFAULT_ADMIN_PASSWORD y DEFAULT_READER_PASSWORD antes de iniciar.'
      );
    }

    const adminPassword = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10);
    const readerPassword = bcrypt.hashSync(DEFAULT_READER_PASSWORD, 10);

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

    console.log('✓ Usuarios por defecto creados');
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
