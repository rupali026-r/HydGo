/**
 * Quick script to add 20 more buses for testing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addBuses() {
  console.log('\n🚌 Adding 20 More Buses...\n');

  try {
    const existingCount = await prisma.bus.count();
    console.log(`ℹ️  Current buses in DB: ${existingCount}`);

    const buses = [
      { regNo: 'TS09UK1234', capacity: 52 },
      { regNo: 'TS09UL5678', capacity: 52 },
      { regNo: 'TS09UM9012', capacity: 48 },
      { regNo: 'TS09UN3456', capacity: 56 },
      { regNo: 'TS09UO7890', capacity: 44 },
      { regNo: 'TS09UP2345', capacity: 52 },
      { regNo: 'TS09UQ6789', capacity: 48 },
      { regNo: 'TS09UR0123', capacity: 56 },
      { regNo: 'TS09US4567', capacity: 40 },
      { regNo: 'TS09UT8901', capacity: 52 },
      { regNo: 'TS09UU1234', capacity: 48 },
      { regNo: 'TS09UV5678', capacity: 56 },
      { regNo: 'TS09UW9012', capacity: 44 },
      { regNo: 'TS09UX3456', capacity: 52 },
      { regNo: 'TS09UY7890', capacity: 48 },
      { regNo: 'TS09UZ2345', capacity: 56 },
      { regNo: 'TS09VA6789', capacity: 40 },
      { regNo: 'TS09VB0123', capacity: 52 },
      { regNo: 'TS09VC4567', capacity: 48 },
      { regNo: 'TS09VD8901', capacity: 56 },
    ];

    let created = 0;

    for (const bus of buses) {
      try {
        await prisma.bus.create({
          data: {
            registrationNo: bus.regNo,
            capacity: bus.capacity,
            status: 'OFFLINE',
            latitude: 17.385044, // Hyderabad default
            longitude: 78.486671,
            heading: 0,
            speed: 0,
            isSimulated: false,
          },
        });

        console.log(`✅ Created: ${bus.regNo} (Capacity: ${bus.capacity})`);
        created++;
      } catch (error: any) {
        console.error(`❌ Failed: ${bus.regNo}`);
      }
    }

    const finalCount = await prisma.bus.count();
    console.log(`\n✅ Successfully created ${created} buses`);
    console.log(`📊 Total buses in DB: ${finalCount}\n`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addBuses();
