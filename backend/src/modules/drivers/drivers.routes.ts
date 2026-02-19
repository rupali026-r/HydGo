import { Router } from 'express';
import { DriversController } from './drivers.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';

const router = Router();
const ctrl = new DriversController();

// Driver endpoints
router.get('/me', authenticate, authorize('DRIVER'), ctrl.getProfile.bind(ctrl));
router.get('/profile', authenticate, authorize('DRIVER'), ctrl.getProfile.bind(ctrl));
router.post('/update-location', authenticate, authorize('DRIVER'), ctrl.updateLocation.bind(ctrl));
router.get('/trip', authenticate, authorize('DRIVER'), ctrl.getTrip.bind(ctrl));

export default router;
