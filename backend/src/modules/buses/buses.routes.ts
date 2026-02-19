import { Router } from 'express';
import { BusesController } from './buses.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const ctrl = new BusesController();

// Nearby buses is public (used by directions fallback + guest mode)
router.get('/nearby', ctrl.getNearby.bind(ctrl));
router.get('/:id', authenticate, ctrl.getById.bind(ctrl));

export default router;
