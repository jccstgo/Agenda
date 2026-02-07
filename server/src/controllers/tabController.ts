import { Request, Response } from 'express';
import db from '../config/database';

interface Tab {
  id: number;
  name: string;
  order_index: number;
}

export const getTabs = (req: Request, res: Response) => {
  try {
    const tabs = db.prepare('SELECT * FROM tabs ORDER BY order_index ASC').all() as Tab[];
    res.json(tabs);
  } catch (error) {
    console.error('Error obteniendo pestañas:', error);
    res.status(500).json({ error: 'Error obteniendo pestañas' });
  }
};
