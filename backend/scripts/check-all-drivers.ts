/**
 * Check all drivers and their approval/bus status
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDrivers() {
  try {
    console.log('\n=== ALL DRIVERS ===\n');
    
    const allDrivers = await prisma.driver.findMany({
      include: {
        user: { select: { email: true, name: true, status: true } },
        bus: { select: { registrationNo: true, id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    allDrivers.forEach((d, i) => {
      const status = d.approved ? '✅ APPROVED' : '❌ PENDING';
      const bus = d.bus ? `🚌 ${d.bus.registrationNo}` : '⚠️  NO BUS';
      console.log(`${i + 1}. ${d.user.name} (${d.user.email})`);
      console.log(`   Status: ${status} | Bus: ${bus}`);
      console.log(`   User Status: ${d.user.status} | Driver Status: ${d.driverStatus}`);
      console.log('');
    });

    const needsApproval = allDrivers.filter(d => !d.approved);
    const needsBus = allDrivers.filter(d => d.approved && !d.busId);

    console.log(`\n📊 Summary:`);
    console.log(`   Total drivers: ${allDrivers.length}`);
    console.log(`   Needs approval: ${needsApproval.length}`);
    console.log(`   Needs bus: ${needsBus.length}`);
    console.log(`   Ready to go online: ${allDrivers.filter(d => d.approved && d.busId).length}`);

    if (needsApproval.length > 0) {
      console.log(`\n⚠️  To approve pending drivers, run:`);
      needsApproval.forEach(d => {
        console.log(`   npx tsx scripts/approve-pending-driver.ts ${d.user.email}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDrivers();
