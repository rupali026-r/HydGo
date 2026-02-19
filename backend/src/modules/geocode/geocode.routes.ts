import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/geocode/reverse?lat=17.41&lng=78.55
 * Proxies Nominatim reverse geocoding to avoid CORS issues on web.
 */
router.get('/reverse', async (req: Request, res: Response) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    res.status(400).json({ success: false, error: { message: 'lat and lng required' } });
    return;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=en`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'HydGo-App/1.0 (hydgo-backend)' },
    });

    if (!response.ok) {
      throw new Error(`Nominatim returned ${response.status}`);
    }

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error: any) {
    logger.warn('Reverse geocode failed', { error: error.message });
    res.status(502).json({ success: false, error: { message: 'Geocode service unavailable' } });
  }
});

export default router;
