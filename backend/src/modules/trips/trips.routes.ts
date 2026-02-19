import { Router } from 'express';
import { TripsController } from './trips.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';

const router = Router();
const ctrl = new TripsController();

router.post('/', authenticate, authorize('DRIVER', 'ADMIN'), ctrl.start.bind(ctrl));
router.patch('/:id/complete', authenticate, authorize('DRIVER', 'ADMIN'), ctrl.complete.bind(ctrl));
router.patch('/:id/cancel', authenticate, authorize('DRIVER', 'ADMIN'), ctrl.cancel.bind(ctrl));

export default router;
