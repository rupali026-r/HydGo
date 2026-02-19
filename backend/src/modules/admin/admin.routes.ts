import { Router } from 'express';
import { AdminController } from './admin.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';

const router = Router();
const ctrl = new AdminController();

// Driver approval
router.get('/drivers/pending', authenticate, authorize('ADMIN'), ctrl.getPendingDrivers.bind(ctrl));
router.patch('/drivers/:id/approve', authenticate, authorize('ADMIN'), ctrl.approveDriver.bind(ctrl));
router.patch('/drivers/:id/reject', authenticate, authorize('ADMIN'), ctrl.rejectDriver.bind(ctrl));

// Notifications
router.get('/notifications', authenticate, authorize('ADMIN'), ctrl.getNotifications.bind(ctrl));
router.patch('/notifications/:id/read', authenticate, authorize('ADMIN'), ctrl.markNotificationRead.bind(ctrl));
router.patch('/notifications/mark-all-read', authenticate, authorize('ADMIN'), ctrl.markAllNotificationsRead.bind(ctrl));

// Dashboard summary
router.get('/dashboard-summary', authenticate, authorize('ADMIN'), ctrl.getDashboardSummary.bind(ctrl));

export default router;
