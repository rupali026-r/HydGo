import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

const ACTIVE_FILTER = { deletedAt: null };

export class UsersService {
  async findById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id, ...ACTIVE_FILTER },
      select: { id: true, name: true, email: true, role: true, status: true, phone: true, createdAt: true },
    });
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    return user;
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { ...ACTIVE_FILTER };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);
    return { users, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'SUSPENDED') {
    await this.findById(id);
    return prisma.user.update({ where: { id }, data: { status } });
  }

  async softDelete(id: string) {
    await this.findById(id);
    return prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
