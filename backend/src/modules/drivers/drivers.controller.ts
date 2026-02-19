import { Request, Response, NextFunction } from 'express';
import { DriversService } from './drivers.service';
import { updateLocationSchema } from './drivers.schema';

const svc = new DriversService();

export class DriversController {
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await svc.getProfile(req.user!.userId);
      res.json({ success: true, data: profile });
    } catch (error) { next(error); }
  }

  async updateLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { latitude, longitude, heading, speed } = updateLocationSchema.parse(req.body);
      const bus = await svc.updateBusLocation(req.user!.userId, latitude, longitude, heading, speed);
      res.json({ success: true, data: { busId: bus.id, latitude: bus.latitude, longitude: bus.longitude } });
    } catch (error) {
      next(error);
    }
  }

  async getTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trip = await svc.getActiveTrip(req.user!.userId);
      res.json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Accept driverId from body or URL params
      const driverId = req.body?.driverId || req.params?.driverId;
      if (!driverId) {
        res.status(400).json({ success: false, message: 'driverId required' });
        return;
      }
      const result = await svc.approve(driverId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getPending(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const drivers = await svc.getPending();
      res.json({ success: true, data: drivers });
    } catch (error) {
      next(error);
    }
  }

  async assignBus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const driverId = req.params.driverId as string;
      const busId = req.body?.busId as string;
      if (!driverId || !busId) {
        res.status(400).json({ success: false, message: 'driverId and busId required' });
        return;
      }
      const result = await svc.assignBus(driverId, busId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
