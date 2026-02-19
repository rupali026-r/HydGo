import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { logger } from '../../utils/logger';

export class AdminController {
  private service = new AdminService();

  async getPendingDrivers(req: Request, res: Response, next: NextFunction) {
    try {
      const drivers = await this.service.getPendingDrivers();
      res.json({ success: true, data: drivers });
    } catch (error) {
      next(error);
    }
  }

  async approveDriver(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const driver = await this.service.approveDriver(id as string);
      res.json({ success: true, data: driver, message: 'Driver approved successfully' });
    } catch (error) {
      next(error);
    }
  }

  async rejectDriver(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const driver = await this.service.rejectDriver(id as string);
      res.json({ success: true, data: driver, message: 'Driver rejected' });
    } catch (error) {
      next(error);
    }
  }

  async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const { unreadOnly } = req.query;
      const notifications = await this.service.getNotifications(unreadOnly === 'true');
      res.json({ success: true, data: notifications });
    } catch (error) {
      next(error);
    }
  }

  async markNotificationRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await this.service.markNotificationRead(id as string);
      res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
      next(error);
    }
  }

  async markAllNotificationsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await this.service.markAllNotificationsRead();
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  }

  async getDashboardSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await this.service.getDashboardSummary();
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
}
