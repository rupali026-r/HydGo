import { Router } from 'express';
import { StopsController } from './stops.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const ctrl = new StopsController();

// Public — all stops for autocomplete
router.get('/', ctrl.getAll.bind(ctrl));

// Public — nearby stops (GPS-based) - must be before /:id routes
router.get('/nearby', ctrl.getNearby.bind(ctrl));

// Public — stop name search
router.get('/search', ctrl.search.bind(ctrl));

router.get('/route/:routeId', authenticate, ctrl.getByRoute.bind(ctrl));

export default router;
