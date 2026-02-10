import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        userId: number;
        username: string;
        role: 'superadmin' | 'admin' | 'reader';
      };
    }
  }
}
