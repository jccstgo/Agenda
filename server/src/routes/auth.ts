import { Router } from 'express';
import { login, verifyToken } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/verify', authenticateToken, verifyToken);

export default router;
