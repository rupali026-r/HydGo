import { z } from 'zod';

export const addStopSchema = z.object({
  name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  routeId: z.string().uuid(),
  stopOrder: z.number().int().positive(),
});

export type AddStopInput = z.infer<typeof addStopSchema>;
