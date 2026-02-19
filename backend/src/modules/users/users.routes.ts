import { Router, Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';

const router = Router();
const svc = new UsersService();

router.use(authenticate, authorize('ADMIN'));

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await svc.findAll(page, limit);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await svc.findById(req.params.id as string);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;
