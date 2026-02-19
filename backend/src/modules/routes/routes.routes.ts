import { Router } from 'express';
import { RoutesController } from './routes.controller';

const router = Router();
const ctrl = new RoutesController();

router.get('/', ctrl.getAll.bind(ctrl));
router.get('/:id', ctrl.getById.bind(ctrl));

export default router;
