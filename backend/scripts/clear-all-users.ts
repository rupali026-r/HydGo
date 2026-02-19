import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllUsers() {
  try {
    console.log('🗑️  Starting to clear all users...');

    // Delete in order to respect foreign key constraints
    
    // 1. Delete all refresh tokens
    const deletedTokens = await prisma.refreshToken.deleteMany({});
    console.log(`✅ Deleted ${deletedTokens.count} refresh tokens`);

    // 2. Delete all driver profiles (has foreign key to users)
    const deletedDrivers = await prisma.driver.deleteMany({});
    console.log(`✅ Deleted ${deletedDrivers.count} driver profiles`);

    // 3. Delete all users
    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`✅ Deleted ${deletedUsers.count} users`);

    console.log('✅ All users cleared successfully!');
    console.log('📝 You can now register and login fresh.');
    
  } catch (error) {
    console.error('❌ Error clearing users:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearAllUsers();
