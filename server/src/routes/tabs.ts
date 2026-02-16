import { Router } from 'express';
import { createTab, deleteTab, getTabs, updateTabs } from '../controllers/tabController';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, getTabs);
router.post('/', authenticateToken, requireSuperAdmin, createTab);
router.put('/', authenticateToken, requireSuperAdmin, updateTabs);
router.delete('/:id', authenticateToken, requireSuperAdmin, deleteTab);

export default router;
