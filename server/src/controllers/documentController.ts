import { Response } from 'express';
import db from '../config/database';
import path from 'path';
import fs from 'fs';
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
  uploaded_by: number;
  created_at: string;
}

export const getDocumentsByTab = (req: AuthRequest, res: Response) => {
  try {
    const { tabId } = req.params;

    const documents = db.prepare(
      'SELECT * FROM documents WHERE tab_id = ? ORDER BY created_at DESC'
    ).all(tabId) as Document[];

    // Obtener nombre de la pestaña
    const tab = db.prepare('SELECT name FROM tabs WHERE id = ?').get(tabId) as any;

    logAudit(req, {
      action: 'LIST_DOCUMENTS',
      resourceType: 'tab',
      resourceId: parseInt(tabId),
      resourceName: tab?.name,
      details: `Consultó ${documents.length} documentos de la pestaña "${tab?.name}"`
    });

    res.json(documents);
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    res.status(500).json({ error: 'Error obteniendo documentos' });
  }
};

export const uploadDocument = (req: AuthRequest, res: Response) => {
  try {
    const { tabId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const userId = req.user?.id;

    const result = db.prepare(`
      INSERT INTO documents (tab_id, filename, original_name, file_path, file_size, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      tabId,
      file.filename,
      file.originalname,
      file.path,
      file.size,
      userId
    );

    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid) as Document;

    // Obtener nombre de la pestaña
    const tab = db.prepare('SELECT name FROM tabs WHERE id = ?').get(tabId) as any;

    logAudit(req, {
      action: 'UPLOAD_DOCUMENT',
      resourceType: 'document',
      resourceId: document.id,
      resourceName: file.originalname,
      details: `Subió el documento "${file.originalname}" (${(file.size / 1024).toFixed(2)} KB) a la pestaña "${tab?.name}"`
    });

    res.status(201).json(document);
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

    // Eliminar archivo del sistema de archivos
    if (fs.existsSync(document.file_path)) {
      fs.unlinkSync(document.file_path);
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
      details: `Eliminó el documento "${document.original_name}" de la pestaña "${tab?.name}"`
    });

    res.json({ message: 'Documento eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando documento:', error);
    res.status(500).json({ error: 'Error eliminando documento' });
  }
};

export const getDocumentFile = (req: AuthRequest, res: Response) => {
  try {
    const { filename } = req.params;
    const { tabId } = req.query;

    const filePath = path.join(UPLOADS_DIR, `tab-${tabId}`, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    // Obtener nombre de la pestaña
    const tab = db.prepare('SELECT name FROM tabs WHERE id = ?').get(tabId) as any;

    logAudit(req, {
      action: 'VIEW_DOCUMENT',
      resourceType: 'document',
      resourceName: filename,
      details: `Visualizó el documento "${filename}" de la pestaña "${tab?.name}"`
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error sirviendo archivo:', error);
    res.status(500).json({ error: 'Error sirviendo archivo' });
  }
};
