import { Router } from 'express';
import { getTabs } from '../controllers/tabController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, getTabs);

export default router;
