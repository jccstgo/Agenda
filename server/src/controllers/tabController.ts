import { Response } from 'express';
import db from '../config/database';
import fs from 'fs';
import type { AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

interface Tab {
  id: number;
  name: string;
  order_index: number;
}

interface TabUpdateInput {
  id: number;
  name: string;
}

interface TabDocumentFile {
  id: number;
  file_path: string;
}

const getOrderedTabs = () => {
  return db
    .prepare('SELECT * FROM tabs ORDER BY order_index ASC, id ASC')
    .all() as Tab[];
};

export const getTabs = (_req: AuthRequest, res: Response) => {
  try {
    res.json(getOrderedTabs());
  } catch (error) {
    console.error('Error obteniendo pestañas:', error);
    res.status(500).json({ error: 'Error obteniendo pestañas' });
  }
};

export const createTab = (req: AuthRequest, res: Response) => {
  try {
    const rawName = req.body?.name;
    const name = typeof rawName === 'string' ? rawName.trim() : '';

    if (!name) {
      return res.status(400).json({ error: 'El nombre del tema es requerido' });
    }

    if (name.length > 120) {
      return res.status(400).json({ error: 'El nombre del tema es demasiado largo' });
    }

    const existingTab = db
      .prepare('SELECT id FROM tabs WHERE lower(name) = lower(?)')
      .get(name) as { id: number } | undefined;

    if (existingTab) {
      return res.status(409).json({ error: 'Ya existe un tema con ese nombre' });
    }

    const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), 0) as max_order FROM tabs').get() as {
      max_order: number;
    };

    const result = db.prepare('INSERT INTO tabs (name, order_index) VALUES (?, ?)').run(name, maxOrder.max_order + 1);
    const newTab = db.prepare('SELECT * FROM tabs WHERE id = ?').get(result.lastInsertRowid) as Tab;

    logAudit(req, {
      action: 'CREATE_TAB',
      resourceType: 'tab',
      resourceId: newTab.id,
      resourceName: newTab.name,
      details: `Creó la pestaña "${newTab.name}" en posición ${newTab.order_index}`,
      statusCode: 201,
      extraContext: {
        tabId: newTab.id,
        tabName: newTab.name,
        orderIndex: newTab.order_index
      }
    });

    res.status(201).json(newTab);
  } catch (error) {
    console.error('Error creando pestaña:', error);
    res.status(500).json({ error: 'Error creando pestaña' });
  }
};

export const updateTabs = (req: AuthRequest, res: Response) => {
  try {
    const tabsPayload = req.body?.tabs;

    if (!Array.isArray(tabsPayload) || tabsPayload.length === 0) {
      return res.status(400).json({ error: 'Debe enviar al menos un tema para actualizar' });
    }

    const parsedTabs = tabsPayload.map((item: unknown) => {
      if (
        typeof item !== 'object' ||
        item === null ||
        !('id' in item) ||
        !('name' in item) ||
        typeof (item as { id: unknown }).id !== 'number' ||
        !Number.isInteger((item as { id: number }).id) ||
        (item as { id: number }).id <= 0 ||
        typeof (item as { name: unknown }).name !== 'string'
      ) {
        return null;
      }

      return {
        id: (item as { id: number }).id,
        name: (item as { name: string }).name.trim()
      } satisfies TabUpdateInput;
    });

    if (parsedTabs.some((tab) => tab === null)) {
      return res.status(400).json({ error: 'Formato inválido en la lista de temas' });
    }

    const validTabs = parsedTabs as TabUpdateInput[];

    if (validTabs.some((tab) => !tab.name)) {
      return res.status(400).json({ error: 'Todos los temas deben tener nombre' });
    }

    if (validTabs.some((tab) => tab.name.length > 120)) {
      return res.status(400).json({ error: 'El nombre de un tema excede el máximo permitido' });
    }

    const uniqueIds = new Set(validTabs.map((tab) => tab.id));
    if (uniqueIds.size !== validTabs.length) {
      return res.status(400).json({ error: 'La lista contiene IDs de temas duplicados' });
    }

    const uniqueNames = new Set(validTabs.map((tab) => tab.name.toLowerCase()));
    if (uniqueNames.size !== validTabs.length) {
      return res.status(400).json({ error: 'No puede haber temas con el mismo nombre' });
    }

    const existingTabs = db.prepare('SELECT id FROM tabs').all() as { id: number }[];
    if (existingTabs.length !== validTabs.length) {
      return res.status(400).json({ error: 'Debe enviar la lista completa de temas' });
    }

    const existingIds = new Set(existingTabs.map((tab) => tab.id));
    if (validTabs.some((tab) => !existingIds.has(tab.id))) {
      return res.status(400).json({ error: 'Uno o más temas no existen' });
    }

    const updateTabsTransaction = db.transaction((tabsToUpdate: TabUpdateInput[]) => {
      const updateTab = db.prepare('UPDATE tabs SET name = ?, order_index = ? WHERE id = ?');
      tabsToUpdate.forEach((tab, index) => {
        updateTab.run(tab.name, index + 1, tab.id);
      });
    });

    const previousTabs = getOrderedTabs();

    updateTabsTransaction(validTabs);
    const orderedTabs = getOrderedTabs();

    logAudit(req, {
      action: 'UPDATE_TABS',
      resourceType: 'tab',
      details: `Actualizó el orden/nombre de ${orderedTabs.length} pestañas`,
      statusCode: 200,
      extraContext: {
        previousTabs: previousTabs.map((tab) => ({
          id: tab.id,
          name: tab.name,
          orderIndex: tab.order_index
        })),
        updatedTabs: orderedTabs.map((tab) => ({
          id: tab.id,
          name: tab.name,
          orderIndex: tab.order_index
        }))
      }
    });

    res.json(orderedTabs);
  } catch (error) {
    console.error('Error actualizando pestañas:', error);
    res.status(500).json({ error: 'Error actualizando pestañas' });
  }
};

export const deleteTab = (req: AuthRequest, res: Response) => {
  try {
    const tabId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(tabId) || tabId <= 0) {
      return res.status(400).json({ error: 'ID de tema inválido' });
    }

    const existingTab = db.prepare('SELECT id, name FROM tabs WHERE id = ?').get(tabId) as
      | { id: number; name: string }
      | undefined;
    if (!existingTab) {
      return res.status(404).json({ error: 'Tema no encontrado' });
    }

    const tabCount = db.prepare('SELECT COUNT(*) as count FROM tabs').get() as { count: number };
    if (tabCount.count <= 1) {
      return res.status(400).json({ error: 'Debe existir al menos un tema' });
    }

    const tabDocuments = db.prepare('SELECT id, file_path FROM documents WHERE tab_id = ?').all(tabId) as TabDocumentFile[];

    const deleteTransaction = db.transaction((id: number) => {
      const deleteDocuments = db.prepare('DELETE FROM documents WHERE tab_id = ?');

      for (const document of tabDocuments) {
        if (fs.existsSync(document.file_path)) {
          fs.unlinkSync(document.file_path);
        }
      }

      deleteDocuments.run(id);
      db.prepare('DELETE FROM tabs WHERE id = ?').run(id);

      const remainingTabs = db.prepare('SELECT id FROM tabs ORDER BY order_index ASC, id ASC').all() as {
        id: number;
      }[];
      const updateOrder = db.prepare('UPDATE tabs SET order_index = ? WHERE id = ?');
      remainingTabs.forEach((tab, index) => {
        updateOrder.run(index + 1, tab.id);
      });
    });

    deleteTransaction(tabId);
    const orderedTabs = getOrderedTabs();

    logAudit(req, {
      action: 'DELETE_TAB',
      resourceType: 'tab',
      resourceId: tabId,
      resourceName: existingTab.name,
      details: `Eliminó la pestaña "${existingTab.name}"`,
      statusCode: 200,
      extraContext: {
        deletedTabId: tabId,
        deletedTabName: existingTab.name,
        deletedDocumentsCount: tabDocuments.length,
        remainingTabs: orderedTabs.map((tab) => ({
          id: tab.id,
          name: tab.name,
          orderIndex: tab.order_index
        }))
      }
    });

    res.json(orderedTabs);
  } catch (error) {
    console.error('Error eliminando pestaña:', error);
    res.status(500).json({ error: 'Error eliminando pestaña' });
  }
};
