/**
 * Script to approve pending driver and auto-assign bus
 * Usage: npx tsx scripts/approve-pending-driver.ts <email>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function approvePendingDriver(email: string) {
  try {
    // Find user and driver
    const user = await prisma.user.findUnique({
      where: { email },
      include: { driver: true },
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    if (!user.driver) {
      console.error(`❌ User is not a driver: ${email}`);
      process.exit(1);
    }

    if (user.driver.approved) {
      console.log(`✅ Driver already approved: ${email}`);
      console.log(`   Bus assigned: ${user.driver.busId || 'None'}`);
      process.exit(0);
    }

    // Find available bus
    const availableBus = await prisma.bus.findFirst({
      where: {
        driver: null,
        status: 'OFFLINE',
      },
    });

    if (!availableBus) {
      console.error(`❌ No available buses to assign`);
      process.exit(1);
    }

    // Approve driver and assign bus
    const updatedDriver = await prisma.driver.update({
      where: { id: user.driver.id },
      data: {
        approved: true,
        busId: availableBus.id,
      },
      include: {
        bus: true,
        user: true,
      },
    });

    // Update user status
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE' },
    });

    console.log(`\n✅ Driver approved successfully!`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${email}`);
    console.log(`   License: ${user.driver.licenseNumber}`);
    console.log(`   Bus Assigned: ${availableBus.registrationNo} (${availableBus.id})`);
    console.log(`   Bus Capacity: ${availableBus.capacity}`);
    console.log(`\n✅ Driver can now login and GO ONLINE in the driver app!`);
    
  } catch (error) {
    console.error('❌ Error approving driver:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line args
const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/approve-pending-driver.ts <email>');
  console.error('Example: npx tsx scripts/approve-pending-driver.ts driver@gmail.com');
  process.exit(1);
}

approvePendingDriver(email);
