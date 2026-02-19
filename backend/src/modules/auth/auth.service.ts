import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { firebaseAuth } from '../../config/firebase';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import { RegisterInput, LoginInput, GoogleSignInInput } from './auth.schema';
import { logger } from '../../utils/logger';

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/**
 * SHA-256 hash for refresh token storage.
 * We never store the raw refresh token in the database.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  // ── Register ──────────────────────────────────────────────────────────────

  async register(input: RegisterInput) {
    const { name, email, password, role, phone, adminSecretKey, licenseNumber } = input;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('Email already registered', 409, 'EMAIL_TAKEN');
    }

    // Driver requires license
    if (role === 'DRIVER' && !licenseNumber) {
      throw new AppError('License number required for driver registration', 400, 'VALIDATION_ERROR');
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        phone,
        status: role === 'DRIVER' ? 'PENDING' : 'ACTIVE',
      },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });

    // Create driver profile
    if (role === 'DRIVER' && licenseNumber) {
      await prisma.driver.create({
        data: {
          userId: user.id,
          licenseNumber,
          driverStatus: 'PENDING',
          approved: false,
        },
      });

      // Create notification for admin
      await prisma.adminNotification.create({
        data: {
          type: 'DRIVER_APPLY',
          title: 'New Driver Application',
          message: `${name} has applied to become a driver`,
          metadata: { userId: user.id, email, licenseNumber },
        },
      });

      // Emit notification to admin namespace
      try {
        const { getAdminNamespace } = await import('../../config/socket');
        const adminNamespace = getAdminNamespace();
        if (adminNamespace) {
          adminNamespace.emit('notification:new', {
            type: 'DRIVER_APPLY',
            title: 'New Driver Application',
            message: `${name} has applied to become a driver`,
          });
        }
      } catch (err) {
        logger.warn('Failed to emit driver registration notification', { error: err });
      }
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);

    logger.info('User registered', { userId: user.id, role });
    return { user, ...tokens };
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(input: LoginInput) {
    const { email, password } = input;

    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
      include: {
        driver: {
          include: {
            bus: {
              include: { route: true },
            },
          },
        },
      },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError('Account suspended — contact support', 403, 'ACCOUNT_SUSPENDED');
    }

    // Allow pending drivers to login - they'll see the pending screen in the app
    // if (user.role === 'DRIVER' && user.driver && !user.driver.approved) {
    //   throw new AppError('Driver account pending admin approval', 403, 'DRIVER_PENDING');
    // }

    const tokens = await this.issueTokens(user.id, user.email, user.role);

    logger.info('User logged in', { userId: user.id, role: user.role });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      driver: user.driver ? {
        id: user.driver.id,
        approved: user.driver.approved,
        driverStatus: user.driver.driverStatus,
        busId: user.driver.busId,
        bus: user.driver.bus ? {
          id: user.driver.bus.id,
          registrationNo: user.driver.bus.registrationNo,
          capacity: user.driver.bus.capacity,
          routeId: user.driver.bus.routeId,
          route: user.driver.bus.route,
        } : null,
      } : null,
      ...tokens,
    };
  }

  // ── Google Sign-In (Firebase) ────────────────────────────────────────────────────────

  async googleSignIn(input: GoogleSignInInput) {
    const { idToken, role } = input;

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await firebaseAuth.verifyIdToken(idToken);
    } catch (error) {
      logger.error('Firebase ID token verification failed', { error });
      throw new AppError('Invalid Firebase token', 401, 'INVALID_FIREBASE_TOKEN');
    }

    const { email, name, picture, uid } = decodedToken;

    if (!email) {
      throw new AppError('Invalid Firebase token payload - missing email', 401, 'INVALID_TOKEN_PAYLOAD');
    }

    logger.info('Firebase token verified', { email, uid });

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        driver: {
          include: {
            bus: {
              include: { route: true },
            },
          },
        },
      },
    });

    // If user doesn't exist, create a new user
    if (!user) {
      // Generate a secure random password (user won't need it since they use Google Sign-In)
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashed = await bcrypt.hash(randomPassword, SALT_ROUNDS);

      user = await prisma.user.create({
        data: {
          name: name || email.split('@')[0],
          email,
          password: hashed,
          role: role || 'PASSENGER',
          status: 'ACTIVE',
        },
        include: {
          driver: {
            include: {
              bus: {
                include: { route: true },
              },
            },
          },
        },
      });

      logger.info('New user created via Firebase Google Sign-In', { userId: user.id, email, firebaseUid: uid });
    } else {
      // User exists - check if they're suspended
      if (user.status === 'SUSPENDED') {
        throw new AppError('Account suspended — contact support', 403, 'ACCOUNT_SUSPENDED');
      }
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);

    logger.info('User logged in via Firebase Google Sign-In', { userId: user.id, role: user.role });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      driver: user.driver ? {
        id: user.driver.id,
        approved: user.driver.approved,
        driverStatus: user.driver.driverStatus,
        busId: user.driver.busId,
        bus: user.driver.bus ? {
          id: user.driver.bus.id,
          registrationNo: user.driver.bus.registrationNo,
          capacity: user.driver.bus.capacity,
          routeId: user.driver.bus.routeId,
          route: user.driver.bus.route,
        } : null,
      } : null,
      ...tokens,
    };
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string) {
    // Verify JWT signature
    let payload: { userId: string; email: string; role: string };
    try {
      payload = jwt.verify(rawRefreshToken, env.JWT_REFRESH_SECRET) as typeof payload;
    } catch {
      throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }

    // Look up the hashed token in DB
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.expiresAt < new Date()) {
      throw new AppError('Refresh token expired or not found', 401, 'TOKEN_EXPIRED');
    }

    // Token rotation: delete the old token
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    // Issue fresh pair
    const tokens = await this.issueTokens(payload.userId, payload.email, payload.role);

    logger.info('Token refreshed', { userId: payload.userId });
    return tokens;
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);

    // Delete this specific token (ignore if not found)
    await prisma.refreshToken.deleteMany({ where: { tokenHash } });

    logger.info('User logged out (token revoked)');
  }

  // ── Token helpers ─────────────────────────────────────────────────────────

  private async issueTokens(userId: string, email: string, role: string) {
    const payload = { userId, email, role };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES as string as any,
    });

    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES as string as any,
    });

    // Store hashed refresh token in DB
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Clean up any existing tokens for this user first
    await prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });

    await prisma.refreshToken.upsert({
      where: { tokenHash },
      update: { userId, expiresAt },
      create: { tokenHash, userId, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
