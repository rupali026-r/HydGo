/**
 * Delete all admin users from the database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Deleting all admin users...');
  
  const result = await prisma.user.deleteMany({
    where: {
      role: 'ADMIN'
    }
  });
  
  console.log(`✅ Deleted ${result.count} admin user(s)`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
