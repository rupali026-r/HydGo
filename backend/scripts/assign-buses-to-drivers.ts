/**
 * Assign buses to all approved drivers that don't have one
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignBusesToDrivers() {
  try {
    // Find approved drivers without buses
    const driversNeedingBus = await prisma.driver.findMany({
      where: {
        approved: true,
        busId: null,
      },
      include: {
        user: { select: { email: true, name: true } },
      },
    });

    if (driversNeedingBus.length === 0) {
      console.log('✅ All approved drivers already have buses assigned!');
      return;
    }

    console.log(`\n🚌 Found ${driversNeedingBus.length} approved drivers without buses\n`);

    // Find available buses
    const availableBuses = await prisma.bus.findMany({
      where: {
        driver: null,
        status: 'OFFLINE',
      },
      take: driversNeedingBus.length,
    });

    if (availableBuses.length < driversNeedingBus.length) {
      console.error(`❌ Not enough buses! Need ${driversNeedingBus.length}, found ${availableBuses.length}`);
      console.log('   Run: npx tsx scripts/seed-buses.ts');
      process.exit(1);
    }

    // Assign buses
    for (let i = 0; i < driversNeedingBus.length; i++) {
      const driver = driversNeedingBus[i];
      const bus = availableBuses[i];

      await prisma.driver.update({
        where: { id: driver.id },
        data: { busId: bus.id },
      });

      console.log(`✅ Assigned ${bus.registrationNo} to ${driver.user.name} (${driver.user.email})`);
    }

    console.log(`\n🎉 Successfully assigned ${driversNeedingBus.length} buses!`);
    console.log(`\n✅ All approved drivers can now GO ONLINE in the driver app!`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

assignBusesToDrivers();
