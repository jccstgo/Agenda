import { Router } from 'express';
import {
  getDocumentsByTab,
  uploadDocuments,
  deleteDocument,
  getDocumentFile
} from '../controllers/documentController';
import { authenticateToken, authenticateTokenFromQuery, requireAdmin } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.get('/:tabId', authenticateToken, getDocumentsByTab);
router.post(
  '/:tabId',
  authenticateToken,
  requireAdmin,
  upload.fields([
    { name: 'files', maxCount: 50 },
    { name: 'file', maxCount: 1 }
  ]),
  uploadDocuments
);
router.delete('/:id', authenticateToken, requireAdmin, deleteDocument);
router.get('/file/:filename', authenticateTokenFromQuery, getDocumentFile);

export default router;
