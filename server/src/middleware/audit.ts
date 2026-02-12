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
  statusCode?: number;
  extraContext?: Record<string, unknown>;
}

const REDACTED_KEYS = new Set([
  'password',
  'newpassword',
  'token',
  'authorization',
  'jwt',
  'secret'
]);

const truncateString = (value: string, max = 200): string => {
  return value.length > max ? `${value.slice(0, max)}…` : value;
};

const sanitizeForAudit = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return truncateString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (depth >= 3) {
    return '[max-depth]';
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeForAudit(entry, depth + 1));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (REDACTED_KEYS.has(key.toLowerCase())) {
        result[key] = '[redacted]';
      } else {
        result[key] = sanitizeForAudit(entry, depth + 1);
      }
    });
    return result;
  }

  return String(value);
};

const getClientIp = (req: express.Request): { ip: string; forwardedFor: string | null; ipSource: string } => {
  const forwardedForRaw = req.get('x-forwarded-for');
  const forwardedFor = forwardedForRaw ? forwardedForRaw.split(',').map((item) => item.trim()).filter(Boolean) : [];

  if (forwardedFor.length > 0) {
    return {
      ip: forwardedFor[0],
      forwardedFor: forwardedForRaw || null,
      ipSource: 'x-forwarded-for'
    };
  }

  const realIp = req.get('x-real-ip');
  if (realIp) {
    return {
      ip: realIp,
      forwardedFor: null,
      ipSource: 'x-real-ip'
    };
  }

  return {
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    forwardedFor: null,
    ipSource: 'request-ip'
  };
};

const buildRequestContext = (req: express.Request, extraContext?: Record<string, unknown>): string => {
  const context = {
    host: req.get('host') || null,
    origin: req.get('origin') || null,
    referer: req.get('referer') || null,
    forwarded: req.get('forwarded') || null,
    acceptLanguage: req.get('accept-language') || null,
    contentType: req.get('content-type') || null,
    contentLength: req.get('content-length') || null,
    secChUa: req.get('sec-ch-ua') || null,
    secChUaPlatform: req.get('sec-ch-ua-platform') || null,
    secChUaMobile: req.get('sec-ch-ua-mobile') || null,
    secFetchSite: req.get('sec-fetch-site') || null,
    secFetchMode: req.get('sec-fetch-mode') || null,
    secFetchDest: req.get('sec-fetch-dest') || null,
    query: sanitizeForAudit(req.query),
    body: sanitizeForAudit(req.body),
    params: sanitizeForAudit(req.params),
    extra: sanitizeForAudit(extraContext || {})
  };

  return JSON.stringify(context);
};

// Función para registrar acciones en la tabla de auditoría
export const logAudit = (
  req: express.Request,
  data: AuditLogData
): void => {
  try {
    const user = req.user;
    if (!user) return;

    const ipData = getClientIp(req);
    const ipAddress = ipData.ip;
    const userAgent = req.get('user-agent') || 'unknown';
    const timestampCDMX = getCDMXTimestamp();
    const requestContext = buildRequestContext(req, {
      forwardedFor: ipData.forwardedFor,
      ipSource: ipData.ipSource,
      requestId: req.get('x-request-id') || null
    });

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
        http_method,
        endpoint,
        status_code,
        request_context,
        timestamp_cdmx
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      req.method,
      req.originalUrl || req.path,
      data.statusCode || null,
      requestContext,
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
          resourceId: req.params.tabId ? parseInt(req.params.tabId) : undefined,
          statusCode: res.statusCode
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
        details: `Visualizó el documento ${req.params.filename}`,
        statusCode: res.statusCode
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
