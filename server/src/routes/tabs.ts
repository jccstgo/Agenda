import { Router } from 'express';
import { createTab, deleteTab, getTabs, updateTabs } from '../controllers/tabController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, getTabs);
router.post('/', authenticateToken, requireAdmin, createTab);
router.put('/', authenticateToken, requireAdmin, updateTabs);
router.delete('/:id', authenticateToken, requireAdmin, deleteTab);

export default router;
