import { Router } from 'express';
import {
  getDocumentsByTab,
  uploadDocument,
  deleteDocument,
  getDocumentFile
} from '../controllers/documentController';
import { authenticateToken, authenticateTokenFromQuery, requireAdmin } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.get('/:tabId', authenticateToken, getDocumentsByTab);
router.post('/:tabId', authenticateToken, requireAdmin, upload.single('file'), uploadDocument);
router.delete('/:id', authenticateToken, requireAdmin, deleteDocument);
router.get('/file/:filename', authenticateTokenFromQuery, getDocumentFile);

export default router;
