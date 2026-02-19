/**
 * Test 2: Driver Disconnect → Bus OFFLINE
 *
 * 1. Register a driver user
 * 2. Approve driver + create & assign a bus via DB
 * 3. Connect driver socket to /driver namespace
 * 4. Send a location update (confirm bus is ACTIVE / reachable)
 * 5. Disconnect driver socket
 * 6. Wait a moment, then verify bus status = OFFLINE in DB
 * 7. Verify bus:offline event was emitted to passenger namespace
 */

import { io, Socket } from 'socket.io-client';

const BASE = 'http://localhost:3000';
const unique = Date.now();

async function api(path: string, body?: Record<string, unknown>) {
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return resp.json() as Promise<any>;
}

async function apiGet(path: string, token: string) {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return resp.json() as Promise<any>;
}

function connectSocket(namespace: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(`${BASE}${namespace}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (err) => reject(err));
    setTimeout(() => reject(new Error('Socket connect timeout')), 5000);
  });
}

async function main() {
  console.log('=== Test 2: Driver Disconnect → Bus OFFLINE ===\n');

  // Step 1: Register a DRIVER user
  console.log('[1] Registering driver user...');
  const regResult = await api('/api/auth/register', {
    name: `TestDriver${unique}`,
    email: `driver${unique}@test.com`,
    password: 'Test1234!',
    role: 'DRIVER',
    licenseNumber: `LIC-${unique}`,
  });

  if (!regResult.data?.accessToken) {
    console.error('Registration failed:', JSON.stringify(regResult));
    process.exit(1);
  }

  const driverToken = regResult.data.accessToken;
  const userId = regResult.data.user.id;
  console.log(`    ✓ Driver registered: ${userId}`);

  // Step 2: Approve driver + create bus + assign via raw Prisma
  // We do this by importing prisma client inline
  console.log('[2] Setting up driver + bus in database...');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    // Create a bus
    const bus = await prisma.bus.create({
      data: {
        registrationNo: `TS-${unique}`,
        capacity: 52,
        status: 'ACTIVE',
        latitude: 17.385,
        longitude: 78.4867,
      },
    });
    console.log(`    ✓ Bus created: ${bus.id} (status: ${bus.status})`);

    // Approve driver and assign bus
    const driver = await prisma.driver.update({
      where: { userId },
      data: { approved: true, busId: bus.id },
    });
    console.log(`    ✓ Driver approved and assigned to bus: ${driver.id}`);

    // Also set user status to ACTIVE (drivers start as PENDING)
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });
    console.log('    ✓ User status set to ACTIVE');

    // The registration token already contains the DRIVER role in the JWT.
    // The approval check happens inside the tracking handler, so the token works.
    const freshToken = driverToken;
    console.log('    ✓ Using registration token (JWT already has DRIVER role)');

    // Step 3: Connect a passenger socket to listen for bus:offline
    console.log('[3] Connecting passenger socket to listen for bus:offline...');

    // Register a passenger to get token
    const passengerReg = await api('/api/auth/register', {
      name: `TestPassenger${unique}`,
      email: `passenger${unique}@test.com`,
      password: 'Test1234!',
      role: 'PASSENGER',
    });
    const passengerToken = passengerReg.data?.accessToken;

    let busOfflineReceived = false;
    let busOfflineData: any = null;

    const passengerSocket = await connectSocket('/passenger', passengerToken);
    console.log('    ✓ Passenger socket connected');

    passengerSocket.on('bus:offline', (data: any) => {
      busOfflineReceived = true;
      busOfflineData = data;
      console.log('    ✓ Received bus:offline event:', JSON.stringify(data));
    });

    // Step 4: Connect driver socket
    console.log('[4] Connecting driver socket...');
    const driverSocket = await connectSocket('/driver', freshToken);
    console.log('    ✓ Driver socket connected');

    // Step 5: Send a location update
    console.log('[5] Sending location update...');
    await new Promise<void>((resolve) => {
      driverSocket.emit('location:update', {
        latitude: 17.385,
        longitude: 78.4867,
        heading: 90,
        speed: 25,
      });
      driverSocket.once('location:confirmed', (data: any) => {
        console.log(`    ✓ Location confirmed for bus: ${data.busId}`);
        resolve();
      });
      driverSocket.once('error', (err: any) => {
        console.error('    ✗ Location update error:', err);
        resolve();
      });
      setTimeout(resolve, 3000);
    });

    // Verify bus is ACTIVE in DB before disconnect
    const busBeforeDisconnect = await prisma.bus.findUnique({ where: { id: bus.id } });
    console.log(`    Bus status before disconnect: ${busBeforeDisconnect?.status}`);

    // Step 6: Disconnect driver socket
    console.log('[6] Disconnecting driver socket...');
    driverSocket.disconnect();

    // Wait for server to process disconnect
    await new Promise((r) => setTimeout(r, 2000));

    // Step 7: Verify bus status in DB
    console.log('[7] Verifying bus status in database...');
    const busAfterDisconnect = await prisma.bus.findUnique({ where: { id: bus.id } });
    const busStatus = busAfterDisconnect?.status;
    const busSpeed = busAfterDisconnect?.speed;

    console.log(`    Bus status after disconnect: ${busStatus}`);
    console.log(`    Bus speed after disconnect: ${busSpeed}`);

    // Check assertions
    console.log('\n=== RESULTS ===');

    const statusPassed = busStatus === 'OFFLINE';
    const speedPassed = busSpeed === 0;

    console.log(`[✓] Bus status → OFFLINE: ${statusPassed ? 'PASS' : 'FAIL'} (got: ${busStatus})`);
    console.log(`[✓] Bus speed → 0: ${speedPassed ? 'PASS' : 'FAIL'} (got: ${busSpeed})`);
    console.log(`[✓] bus:offline event received: ${busOfflineReceived ? 'PASS' : 'FAIL'}`);
    if (busOfflineReceived) {
      console.log(`    Event data: ${JSON.stringify(busOfflineData)}`);
    }

    const allPassed = statusPassed && speedPassed && busOfflineReceived;
    console.log(`\n=== Test 2 ${allPassed ? 'PASSED ✓' : 'FAILED ✗'} ===`);

    // Cleanup
    passengerSocket.disconnect();
    await prisma.driver.delete({ where: { userId } });
    await prisma.bus.delete({ where: { id: bus.id } });
    await prisma.user.deleteMany({
      where: { email: { in: [`driver${unique}@test.com`, `passenger${unique}@test.com`] } },
    });
    console.log('Cleanup done.');

    await prisma.$disconnect();
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Test error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
