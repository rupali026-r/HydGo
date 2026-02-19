import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  createUser(data: {
    email: string;
    passwordHash: string;
    role: 'PASSENGER' | 'DRIVER' | 'ADMIN';
    name?: string | null;
    phone?: string | null;
    city?: string | null;
    driverStatus?: string;
    busType?: string | null;
    licenseNumber?: string | null;
    experience?: number | null;
    depotLocation?: string | null;
  }) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role as any,
        name: data.name ?? null,
        phone: data.phone ?? null,
        city: data.city ?? null,
        driverStatus: data.driverStatus as any ?? undefined,
        busType: data.busType as any ?? undefined,
        licenseNumber: data.licenseNumber ?? null,
        experience: data.experience ?? null,
        depotLocation: data.depotLocation ?? null,
      },
    });
  }

  async updateDriverStatus(userId: string, status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED') {
    return this.prisma.user.update({
      where: { id: userId },
      data: { driverStatus: status as any },
    });
  }

  async findDriversPending() {
    return this.prisma.user.findMany({
      where: { role: 'DRIVER' as any, driverStatus: 'PENDING_APPROVAL' as any },
      select: { id: true, email: true, name: true, phone: true, busType: true, licenseNumber: true, experience: true, depotLocation: true, createdAt: true },
    });
  }
}
