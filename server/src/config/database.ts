import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');
const db = new Database(dbPath);

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
    const adminPassword = bcrypt.hashSync('admin123', 10);
    const readerPassword = bcrypt.hashSync('lector123', 10);

    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', adminPassword, 'admin');
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('lector', readerPassword, 'reader');

    console.log('✓ Usuarios por defecto creados');
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
