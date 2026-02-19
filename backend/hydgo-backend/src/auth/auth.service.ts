import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

const REFRESH_EXPIRES = Number(process.env.JWT_REFRESH_EXPIRES_SECONDS ?? 7 * 24 * 60 * 60);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(body: {
    email: string;
    password: string;
    role: 'PASSENGER' | 'DRIVER' | 'ADMIN';
    name?: string | null;
    phone?: string | null;
    city?: string | null;
    adminSecretKey?: string;
    busType?: string | null;
    licenseNumber?: string | null;
    experience?: number | null;
    depotLocation?: string | null;
  }) {
    const existing = await this.users.findByEmail(body.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Admin registration requires secret key
    if (body.role === 'ADMIN') {
      const adminSecret = process.env.ADMIN_SECRET;
      if (!adminSecret || body.adminSecretKey !== adminSecret) {
        throw new ForbiddenException('Invalid admin secret key');
      }
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await this.users.createUser({
      email: body.email,
      passwordHash,
      role: body.role,
      name: body.name ?? null,
      phone: body.phone ?? null,
      city: body.city ?? null,
      // Driver-specific fields
      driverStatus: body.role === 'DRIVER' ? 'PENDING_APPROVAL' : undefined,
      busType: body.role === 'DRIVER' ? (body.busType ?? null) : null,
      licenseNumber: body.role === 'DRIVER' ? (body.licenseNumber ?? null) : null,
      experience: body.role === 'DRIVER' ? (body.experience ?? null) : null,
      depotLocation: body.role === 'DRIVER' ? (body.depotLocation ?? null) : null,
    });

    // Drivers get tokens but with PENDING status — frontend handles the routing
    const tokens = await this.issueTokens(user);
    return {
      success: true,
      ...tokens,
    };
  }

  async login(body: { email: string; password: string; role: 'PASSENGER' | 'DRIVER' | 'ADMIN' }) {
    const user = await this.users.findByEmail(body.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    if (user.role !== body.role) {
      throw new UnauthorizedException(`This account is registered as ${user.role.toLowerCase()}`);
    }

    // Check driver status
    if (user.role === 'DRIVER' && user.driverStatus === 'SUSPENDED') {
      throw new ForbiddenException('Your driver account has been suspended. Contact support.');
    }

    const tokens = await this.issueTokens(user);
    return {
      success: true,
      ...tokens,
      user: {
        ...tokens.user,
        status: user.role === 'DRIVER' ? (user.driverStatus ?? 'ACTIVE') : 'ACTIVE',
      },
    };
  }

  async refresh(userId: string, token: string) {
    const found = await this.prisma.refreshToken.findFirst({ where: { userId, token, revokedAt: null } });
    if (!found || found.expiresAt < new Date()) throw new UnauthorizedException('Invalid refresh');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Invalid refresh');
    const tokens = await this.issueTokens(user, token);
    return { success: true, ...tokens };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, token: refreshToken, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { message: 'Logged out successfully' };
  }

  private async issueTokens(user: { id: string; email: string; name?: string | null; role: any; driverStatus?: any }, reuseRefreshToken?: string) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);

    let refreshToken = reuseRefreshToken;
    if (!refreshToken) {
      const refreshJwt = new JwtService({ secret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret' });
      refreshToken = await refreshJwt.signAsync(payload, { expiresIn: REFRESH_EXPIRES });
      const decoded = this.jwt.decode(refreshToken) as any;
      await this.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(decoded?.exp ? decoded.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        role: user.role,
        status: user.driverStatus ?? 'ACTIVE',
      },
      accessToken,
      refreshToken,
    };
  }
}
