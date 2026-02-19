import { z } from 'zod';

export const addRouteSchema = z.object({
  routeNumber: z.string().min(1).max(20),
  name: z.string().min(2).max(200),
  routeType: z.enum(['LOCAL', 'METRO_EXPRESS', 'SUPER_LUXURY', 'PALLE_VELUGU', 'EXPRESS', 'GARUDA_PLUS']),
  polyline: z.string().min(2),
  avgSpeed: z.number().positive().optional(),
  distance: z.number().nonnegative().optional(),
});

export type AddRouteInput = z.infer<typeof addRouteSchema>;
