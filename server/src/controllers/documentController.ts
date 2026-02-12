import { Response } from 'express';
import db from '../config/database';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from '../config/env';
import { logAudit } from '../middleware/audit';

interface Document {
  id: number;
  tab_id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  file_hash: string | null;
  uploaded_by: number;
  created_at: string;
}

const normalizeOriginalName = (value: string): string => {
  const normalized = value.normalize('NFC');

  // Corregir casos comunes de mojibake UTF-8 interpretado como latin1 (ej: "PlaneaciÃ³n")
  if (!/[ÃÂâ]/.test(normalized)) {
    return normalized;
  }

  const decoded = Buffer.from(normalized, 'latin1').toString('utf8').normalize('NFC');
  return decoded.includes('�') ? normalized : decoded;
};

export const getDocumentsByTab = (req: AuthRequest, res: Response) => {
  try {
    const { tabId } = req.params;

    const documentsFromDb = db.prepare(
      'SELECT * FROM documents WHERE tab_id = ? ORDER BY lower(original_name) ASC, id ASC'
    ).all(tabId) as Document[];
    const documents = documentsFromDb
      .map((doc) => ({
        ...doc,
        original_name: normalizeOriginalName(doc.original_name)
      }))
      .sort(
        (a, b) =>
          a.original_name.localeCompare(b.original_name, 'es', { sensitivity: 'base' }) || a.id - b.id
      );

    // Obtener nombre de la pestaña
    const tab = db.prepare('SELECT name FROM tabs WHERE id = ?').get(tabId) as any;

    logAudit(req, {
      action: 'LIST_DOCUMENTS',
      resourceType: 'tab',
      resourceId: parseInt(tabId),
      resourceName: tab?.name,
      details: `Consultó ${documents.length} documentos de la pestaña "${tab?.name}"`,
      statusCode: 200,
      extraContext: {
        tabId: parseInt(tabId),
        documentsCount: documents.length
      }
    });

    res.json(documents);
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    res.status(500).json({ error: 'Error obteniendo documentos' });
  }
};

export const uploadDocuments = (req: AuthRequest, res: Response) => {
  try {
    const { tabId } = req.params;
    const files = Array.isArray(req.files)
      ? req.files
      : req.files
      ? Object.values(req.files as Record<string, Express.Multer.File[]>).flat()
      : [];

    if (files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron archivos' });
    }

    const userId = req.user?.id;
    const insertDocument = db.prepare(`
      INSERT INTO documents (tab_id, filename, original_name, file_path, file_size, mime_type, file_hash, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const getDocumentById = db.prepare('SELECT * FROM documents WHERE id = ?');

    const uploadTransaction = db.transaction((filesToInsert: Express.Multer.File[]) => {
      const createdDocuments: Document[] = [];
      filesToInsert.forEach((file) => {
        const originalName = normalizeOriginalName(file.originalname);
        let fileHash: string | null = null;
        try {
          const buffer = fs.readFileSync(file.path);
          fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
        } catch (error) {
          console.error(`No se pudo calcular hash para ${file.originalname}:`, error);
        }

        const result = insertDocument.run(
          tabId,
          file.filename,
          originalName,
          file.path,
          file.size,
          file.mimetype || null,
          fileHash,
          userId
        );
        const createdDocument = getDocumentById.get(result.lastInsertRowid) as Document;
        createdDocuments.push(createdDocument);
      });
      return createdDocuments;
    });

    const createdDocuments = uploadTransaction(files);

    // Obtener nombre de la pestaña
    const tab = db.prepare('SELECT name FROM tabs WHERE id = ?').get(tabId) as any;

    createdDocuments.forEach((document) => {
      logAudit(req, {
        action: 'UPLOAD_DOCUMENT',
        resourceType: 'document',
        resourceId: document.id,
        resourceName: document.original_name,
        details: `Subió el documento "${document.original_name}" (${(document.file_size / 1024).toFixed(2)} KB) a la pestaña "${tab?.name}"`,
        statusCode: 201,
        extraContext: {
          tabId: parseInt(tabId),
          fileSize: document.file_size,
          mimeType: document.mime_type,
          fileHash: document.file_hash
        }
      });
    });

    res.status(201).json(createdDocuments);
  } catch (error) {
    console.error('Error subiendo documento:', error);
    res.status(500).json({ error: 'Error subiendo documento' });
  }
};

export const deleteDocument = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Obtener información del documento
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as Document | undefined;

    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Intentar eliminar archivo físico sin bloquear la eliminación lógica en BD
    try {
      if (fs.existsSync(document.file_path)) {
        fs.unlinkSync(document.file_path);
      }
    } catch (fileError) {
      console.warn(`No se pudo eliminar archivo físico del documento ${document.id}:`, fileError);
    }

    // Eliminar de la base de datos
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);

    // Obtener nombre de la pestaña
    const tab = db.prepare('SELECT name FROM tabs WHERE id = ?').get(document.tab_id) as any;

    logAudit(req, {
      action: 'DELETE_DOCUMENT',
      resourceType: 'document',
      resourceId: document.id,
      resourceName: document.original_name,
      details: `Eliminó el documento "${document.original_name}" de la pestaña "${tab?.name}"`,
      statusCode: 200,
      extraContext: {
        tabId: document.tab_id,
        fileSize: document.file_size,
        mimeType: document.mime_type,
        fileHash: document.file_hash
      }
    });

    res.json({ message: 'Documento eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando documento:', error);
    res.status(500).json({ error: 'Error eliminando documento' });
  }
};

export const getDocumentFile = (req: AuthRequest, res: Response) => {
  try {
    const rawFilename = req.params.filename;
    const safeFilename = path.basename(rawFilename);
    const tabIdParam = req.query.tabId;
    const tabId = typeof tabIdParam === 'string' ? Number.parseInt(tabIdParam, 10) : Number(tabIdParam);

    if (!Number.isInteger(tabId) || tabId <= 0) {
      return res.status(400).json({ error: 'tabId inválido' });
    }

    const document = db.prepare('SELECT * FROM documents WHERE tab_id = ? AND filename = ?').get(tabId, safeFilename) as
      | Document
      | undefined;

    const fallbackPath = path.join(UPLOADS_DIR, `tab-${tabId}`, safeFilename);
    const candidatePaths = [document?.file_path, fallbackPath].filter(
      (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
    );
    const resolvedFilePath = candidatePaths.find((candidate) => fs.existsSync(candidate));

    if (!resolvedFilePath) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    // Si se recuperó por fallback, sincronizar la ruta para futuras consultas.
    if (document && document.file_path !== resolvedFilePath) {
      db.prepare('UPDATE documents SET file_path = ? WHERE id = ?').run(resolvedFilePath, document.id);
    }

    // Obtener nombre de la pestaña
    const tab = db.prepare('SELECT name FROM tabs WHERE id = ?').get(tabId) as any;

    logAudit(req, {
      action: 'VIEW_DOCUMENT',
      resourceType: 'document',
      resourceName: safeFilename,
      details: `Visualizó el documento "${safeFilename}" de la pestaña "${tab?.name}"`,
      statusCode: 200,
      extraContext: {
        tabId
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    res.sendFile(resolvedFilePath);
  } catch (error) {
    console.error('Error sirviendo archivo:', error);
    res.status(500).json({ error: 'Error sirviendo archivo' });
  }
};
