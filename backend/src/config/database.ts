import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e) => {
  logger.error('Prisma error', { message: e.message });
});

prisma.$on('warn', (e) => {
  logger.warn('Prisma warning', { message: e.message });
});

export { prisma };

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis');
    logger.info('PostGIS extension enabled');
  } catch (error) {
    logger.error('Database connection failed', { error });
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
