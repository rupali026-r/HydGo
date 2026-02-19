import { Request, Response, NextFunction } from 'express';
import { RoutesService } from './routes.service';
import { addRouteSchema } from './routes.schema';

const svc = new RoutesService();

export class RoutesController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = addRouteSchema.parse(req.body);
      const route = await svc.create(data);
      res.status(201).json({ success: true, data: route });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const route = await svc.findById(req.params.id as string);
      res.json({ success: true, data: route });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const routes = await svc.findAll();
      res.json({ success: true, data: routes });
    } catch (error) {
      next(error);
    }
  }
}
