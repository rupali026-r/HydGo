import { Request, Response, NextFunction } from 'express';
import { TripsService } from './trips.service';

const svc = new TripsService();

export class TripsController {
  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { busId } = req.body;
      const trip = await svc.start(busId);
      res.status(201).json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trip = await svc.complete(req.params.id as string);
      res.json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trip = await svc.cancel(req.params.id as string);
      res.json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }
}
