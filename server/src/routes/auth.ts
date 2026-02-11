import { Router } from 'express';
import { login, verifyToken, resetDefaultPasswordsFromLogin } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/reset-default-passwords', resetDefaultPasswordsFromLogin);
router.get('/verify', authenticateToken, verifyToken);

export default router;
