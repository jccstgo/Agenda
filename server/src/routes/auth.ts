import { Router } from 'express';
import { login, verifyToken, changeOwnPassword } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/verify', authenticateToken, verifyToken);
router.post('/change-password', authenticateToken, changeOwnPassword);

export default router;
