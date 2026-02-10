import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './config/database';
import { DB_PATH, UPLOADS_DIR, IS_PRODUCTION } from './config/env';

// Importar rutas
import authRoutes from './routes/auth';
import tabRoutes from './routes/tabs';
import documentRoutes from './routes/documents';
import adminRoutes from './routes/admin';
import superadminRoutes from './routes/superadmin';

// Inicializar base de datos
initDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del cliente en producción
if (IS_PRODUCTION) {
  const clientBuildPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuildPath));
}

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/tabs', tabRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superadminRoutes);

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor funcionando correctamente' });
});

// En producción, servir el index.html para cualquier ruta no API
if (IS_PRODUCTION) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

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
