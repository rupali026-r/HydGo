import { Request, Response, NextFunction } from 'express';
import { StopsService } from './stops.service';
import { addStopSchema } from './stops.schema';

const svc = new StopsService();

export class StopsController {
  async getAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stops = await svc.getAll();
      res.json({ success: true, data: stops });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = addStopSchema.parse(req.body);
      const stop = await svc.create(data);
      res.status(201).json({ success: true, data: stop });
    } catch (error) {
      next(error);
    }
  }

  async getByRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stops = await svc.getByRoute(req.params.routeId as string);
      res.json({ success: true, data: stops });
    } catch (error) {
      next(error);
    }
  }

  async getNearby(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat((req.query.radius as string) ?? '2000');
      const limit = parseInt((req.query.limit as string) ?? '20', 10);

      if (isNaN(lat) || isNaN(lng)) {
        res.status(400).json({ success: false, error: 'lat and lng query params are required' });
        return;
      }

      const stops = await svc.getNearby(lat, lng, isNaN(radius) ? 2000 : radius, isNaN(limit) ? 20 : limit);
      res.json({ success: true, data: stops });
    } catch (error) {
      next(error);
    }
  }

  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = (req.query.q as string) ?? '';
      const stops = await svc.search(q);
      res.json({ success: true, data: stops });
    } catch (error) {
      next(error);
    }
  }
}
