import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authLimiter } from '../../middleware/rate-limit.middleware';

const router = Router();
const ctrl = new AuthController();

router.post('/register', authLimiter, ctrl.register.bind(ctrl));
router.post('/login', authLimiter, ctrl.login.bind(ctrl));
router.post('/google', authLimiter, ctrl.googleSignIn.bind(ctrl));
router.post('/refresh', authLimiter, ctrl.refresh.bind(ctrl));
router.post('/logout', ctrl.logout.bind(ctrl));

export default router;
