import { Router, Request, Response, NextFunction } from 'express';
import { pushService } from '../notifications/push.service';

const router = Router();

/**
 * POST /api/passenger/register-push
 * Register an Expo push notification token for the current user.
 */
router.post('/register-push', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pushToken } = req.body;

    if (!pushToken || typeof pushToken !== 'string') {
      res.status(400).json({
        success: false,
        message: 'pushToken is required and must be a string',
      });
      return;
    }

    // Validate Expo push token format: ExponentPushToken[...] or ExpoPushToken[...]
    if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
      res.status(400).json({
        success: false,
        message: 'Invalid Expo push token format',
      });
      return;
    }

    await pushService.registerToken(req.user!.userId, pushToken);

    res.json({
      success: true,
      data: { message: 'Push token registered successfully' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/passenger/unregister-push
 * Remove the push notification token for the current user.
 */
router.delete('/unregister-push', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pushService.unregisterToken(req.user!.userId);

    res.json({
      success: true,
      data: { message: 'Push token unregistered successfully' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
