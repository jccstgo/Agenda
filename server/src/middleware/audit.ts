import express from 'express';
import db from '../config/database';

// Función para obtener fecha/hora en zona horaria de CDMX
const getCDMXTimestamp = (): string => {
  const now = new Date();
  // Convertir a CDMX (America/Mexico_City)
  const cdmxTime = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now);

  return cdmxTime;
};

export interface AuditLogData {
  action: string;
  resourceType?: string;
  resourceId?: number;
  resourceName?: string;
  details?: string;
}

// Función para registrar acciones en la tabla de auditoría
export const logAudit = (
  req: express.Request,
  data: AuditLogData
): void => {
  try {
    const user = req.user;
    if (!user) return;

    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    const timestampCDMX = getCDMXTimestamp();

    const stmt = db.prepare(`
      INSERT INTO audit_logs (
        user_id,
        username,
        action,
        resource_type,
        resource_id,
        resource_name,
        details,
        ip_address,
        user_agent,
        timestamp_cdmx
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      user.userId,
      user.username,
      data.action,
      data.resourceType || null,
      data.resourceId || null,
      data.resourceName || null,
      data.details || null,
      ipAddress,
      userAgent,
      timestampCDMX
    );
  } catch (error) {
    console.error('Error registrando auditoría:', error);
    // No fallar la operación principal si falla el logging
  }
};

// Middleware para loggear automáticamente todas las peticiones autenticadas
export const auditMiddleware = (action: string) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Guardar la función send original
    const originalSend = res.send;

    // Sobrescribir res.send para capturar cuando la respuesta sea exitosa
    res.send = function (data: any): express.Response {
      // Solo loggear si la respuesta fue exitosa (status 2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logAudit(req, {
          action,
          resourceType: req.params.tabId ? 'tab' : undefined,
          resourceId: req.params.tabId ? parseInt(req.params.tabId) : undefined
        });
      }

      // Llamar a la función send original
      return originalSend.call(this, data);
    };

    next();
  };
};

// Middleware específico para loggear visualización de documentos
export const auditDocumentView = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const originalSend = res.send;

  res.send = function (data: any): express.Response {
    if (res.statusCode >= 200 && res.statusCode < 300 && req.params.filename) {
      logAudit(req, {
        action: 'VIEW_DOCUMENT',
        resourceType: 'document',
        resourceName: req.params.filename,
        details: `Visualizó el documento ${req.params.filename}`
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

// Middleware para loggear descargas
export const auditDocumentDownload = (req: express.Request, filename: string) => {
  logAudit(req, {
    action: 'DOWNLOAD_DOCUMENT',
    resourceType: 'document',
    resourceName: filename,
    details: `Descargó el documento ${filename}`
  });
};

export { getCDMXTimestamp };
