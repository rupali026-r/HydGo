import { Request, Response, NextFunction } from 'express';
import { BusesService } from './buses.service';

const svc = new BusesService();

export class BusesController {
  async getNearby(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lat = Number(req.query.latitude);
      const lng = Number(req.query.longitude);
      const radius = Number(req.query.radius) || 5;

      if (isNaN(lat) || isNaN(lng)) {
        res.status(400).json({ success: false, message: 'latitude and longitude are required query params' });
        return;
      }

      const buses = await svc.getNearby(lat, lng, radius);
      res.json({ success: true, data: buses });
    } catch (error) {
      next(error);
    }
  }

  async getAllActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buses = await svc.getAllActive();
      res.json({ success: true, data: buses });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bus = await svc.findById(req.params.id as string);
      res.json({ success: true, data: bus });
    } catch (error) {
      next(error);
    }
  }
}
