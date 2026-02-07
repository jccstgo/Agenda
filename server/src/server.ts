import express from 'express';
import cors from 'cors';
import { initDatabase } from './config/database';
import { DB_PATH, UPLOADS_DIR } from './config/env';

// Importar rutas
import authRoutes from './routes/auth';
import tabRoutes from './routes/tabs';
import documentRoutes from './routes/documents';

// Inicializar base de datos
initDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/tabs', tabRoutes);
app.use('/api/documents', documentRoutes);

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor funcionando correctamente' });
});

// Manejo de errores
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Error interno del servidor'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`📊 Base de datos: ${DB_PATH}`);
  console.log(`📁 Directorio de uploads: ${UPLOADS_DIR}\n`);
});
