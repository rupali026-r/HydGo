/**
 * Script to seed test buses for driver assignment
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedBuses() {
  console.log('\n🚌 Seeding Test Buses...\n');

  try {
    // Check if buses already exist
    const existingCount = await prisma.bus.count();
    
    if (existingCount > 0) {
      console.log(`ℹ️  ${existingCount} buses already exist in database`);
      const response = await new Promise<string>((resolve) => {
        process.stdout.write('Do you want to add more buses? (y/n): ');
        process.stdin.once('data', (data) => resolve(data.toString().trim()));
      });
      
      if (response.toLowerCase() !== 'y') {
        console.log('✅ Skipping bus creation');
        process.exit(0);
      }
    }

    const buses = [
      { regNo: 'TS09UA1234', capacity: 52 },
      { regNo: 'TS09UB5678', capacity: 52 },
      { regNo: 'TS09UC9012', capacity: 52 },
      { regNo: 'TS09UD3456', capacity: 52 },
      { regNo: 'TS09UE7890', capacity: 48 },
      { regNo: 'TS09UF2345', capacity: 48 },
      { regNo: 'TS09UG6789', capacity: 56 },
      { regNo: 'TS09UH0123', capacity: 56 },
      { regNo: 'TS09UI4567', capacity: 40 },
      { regNo: 'TS09UJ8901', capacity: 44 },
    ];

    let created = 0;
    let skipped = 0;

    for (const bus of buses) {
      try {
        const existing = await prisma.bus.findUnique({
          where: { registrationNo: bus.regNo },
        });

        if (existing) {
          console.log(`⏭️  Bus ${bus.regNo} already exists`);
          skipped++;
          continue;
        }

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

        console.log(`✅ Created bus: ${bus.regNo} (Capacity: ${bus.capacity})`);
        created++;
      } catch (error: any) {
        console.error(`❌ Failed to create bus ${bus.regNo}:`, error.message);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total buses in DB: ${existingCount + created}\n`);

    // Show all buses
    const allBuses = await prisma.bus.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    console.log('📋 Latest Buses:');
    allBuses.forEach((b, i) => {
      console.log(`   ${i + 1}. ${b.registrationNo} - ${b.status} - Capacity: ${b.capacity}`);
    });

  } catch (error: any) {
    console.error('❌ Error seeding buses:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedBuses();
