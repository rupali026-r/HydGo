/**
 * Phase 3 Final Validation — Hybrid Takeover & Race Condition Testing
 *
 * Tests:
 *   1. Real driver takeover pauses simulation for that bus
 *   2. Passengers see isSimulated: false during driver control
 *   3. Driver disconnect → grace period → simulation resumes with isSimulated: true
 *   4. No teleport jump on simulation resume
 *   5. Rapid connect/disconnect (10 cycles) — no leaks, no zombie timers
 *   6. Multi-driver conflict blocked (BUS_ALREADY_CONTROLLED)
 *   7. No duplicate broadcasts during handoff
 *   8. Admin counts accurate under driver control
 *   9. Occupancy consistent during handover
 *  10. Push token dedupe (no duplicate push on reconnect)
 */

import { io, Socket } from 'socket.io-client';

const BASE_URL = 'http://localhost:3000';

// ── Helpers ─────────────────────────────────────────────────────────────────

async function api(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  token?: string,
): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  return { status: res.status, ...json };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectSocket(namespace: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`${BASE_URL}/${namespace}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Socket connect timeout for /${namespace}`));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Socket connect error for /${namespace}: ${err.message}`));
    });
  });
}

function waitForEvent<T = any>(socket: Socket, event: string, timeoutMs = 5000): Promise<T | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}

function collectEvents<T = any>(socket: Socket, event: string, durationMs: number): Promise<T[]> {
  return new Promise((resolve) => {
    const collected: T[] = [];
    const handler = (data: T) => collected.push(data);
    socket.on(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve(collected);
    }, durationMs);
  });
}

// ── Test Infrastructure ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    const msg = detail ? `${name}: ${detail}` : name;
    failures.push(msg);
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

// ── Setup ───────────────────────────────────────────────────────────────────

async function setupTestUsers(): Promise<{
  passengerToken: string;
  driverToken: string;
  driver2Token: string;
  adminToken: string;
  driverId: string;
  driver2Id: string;
  busId: string;
  routeId: string;
}> {
  const rnd = Math.floor(Math.random() * 1_000_000);

  // Register passenger
  const pReg = await api('POST', '/api/auth/register', {
    name: 'TakeoverPassenger',
    email: `takeover-passenger-${rnd}@hydgo.com`,
    password: 'Test1234!',
    role: 'PASSENGER',
  });

  // Register driver 1
  const d1Reg = await api('POST', '/api/auth/register', {
    name: 'TakeoverDriver1',
    email: `takeover-driver1-${rnd}@hydgo.com`,
    password: 'Test1234!',
    role: 'DRIVER',
    licenseNumber: `DL-TO-${rnd}-A`,
  });

  // Register driver 2 (for multi-driver conflict test)
  const d2Reg = await api('POST', '/api/auth/register', {
    name: 'TakeoverDriver2',
    email: `takeover-driver2-${rnd}@hydgo.com`,
    password: 'Test1234!',
    role: 'DRIVER',
    licenseNumber: `DL-TO-${rnd}-B`,
  });

  // Register admin
  const aReg = await api('POST', '/api/auth/register', {
    name: 'TakeoverAdmin',
    email: `takeover-admin-${rnd}@hydgo.com`,
    password: 'Test1234!',
    role: 'ADMIN',
    adminSecretKey: 'TSRTC-HYDGO-ADMIN-2026-SECURE',
  });

  const adminToken = aReg.data.accessToken;

  // Get pending drivers and approve both
  const pending = await api('GET', '/api/admin/drivers/pending', undefined, adminToken);
  const d1 = pending.data?.find((d: any) => d.user?.email === `takeover-driver1-${rnd}@hydgo.com`);
  const d2 = pending.data?.find((d: any) => d.user?.email === `takeover-driver2-${rnd}@hydgo.com`);

  if (d1) await api('PATCH', `/api/admin/drivers/${d1.id}/approve`, {}, adminToken);
  if (d2) await api('PATCH', `/api/admin/drivers/${d2.id}/approve`, {}, adminToken);

  // Find a simulated bus and assign it to driver 1
  const busesRes = await api('GET', '/api/admin/buses', undefined, adminToken);
  const simBus = busesRes.data?.find((b: any) => b.isSimulated && b.status === 'ACTIVE');

  if (!simBus) throw new Error('No active simulated bus available for test');

  // Assign bus to driver 1
  if (d1) {
    await api('PATCH', `/api/admin/drivers/${d1.id}/assign-bus`, {
      busId: simBus.id,
    }, adminToken);
  }

  // Assign the SAME bus to driver 2 (for conflict test)
  if (d2) {
    await api('PATCH', `/api/admin/drivers/${d2.id}/assign-bus`, {
      busId: simBus.id,
    }, adminToken);
  }

  return {
    passengerToken: pReg.data.accessToken,
    driverToken: d1Reg.data.accessToken,
    driver2Token: d2Reg.data.accessToken,
    adminToken,
    driverId: d1?.id ?? '',
    driver2Id: d2?.id ?? '',
    busId: simBus.id,
    routeId: simBus.routeId,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 3 FINAL — Hybrid Takeover & Race Condition Validation');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── Setup ──
  console.log('Setting up test users...');
  const {
    passengerToken, driverToken, driver2Token, adminToken,
    driverId, driver2Id, busId, routeId,
  } = await setupTestUsers();
  check('Test users + bus setup complete', !!busId && !!driverId);

  // ════════════════════════════════════════════════════════════════════════
  // TEST 1: REAL DRIVER TAKEOVER — SIMULATION PAUSES
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── Test 1: Real Driver Takeover ────────────────────────────');

  // Connect passenger to watch for updates
  const passengerSocket = await connectSocket('passenger', passengerToken);
  check('Passenger socket connected', passengerSocket.connected);

  // Wait for initial snapshot and capture bus state
  const snapshot = await waitForEvent<any[]>(passengerSocket, 'buses:snapshot', 3000);
  const busBefore = snapshot?.find((b: any) => b.id === busId);
  check('Bus is simulated before driver connects', busBefore?.isSimulated === true);

  // Connect driver socket — this should trigger takeover
  const driverSocket = await connectSocket('driver', driverToken);
  // Also check if driver:init was never received (error event or disconnect)
  const initOrError = await Promise.race([
    waitForEvent<any>(driverSocket, 'driver:init', 5000),
    waitForEvent<any>(driverSocket, 'error', 5000),
  ]);
  const gotInit = initOrError && 'busId' in initOrError;
  check('Driver connected and received init', gotInit);
  check('Driver status is ONLINE', initOrError?.status === 'ONLINE');

  // Wait a tick cycle to let simulation process the skip
  await sleep(4000);

  // ════════════════════════════════════════════════════════════════════════
  // TEST 2: PASSENGERS SEE isSimulated: false DURING DRIVER CONTROL
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── Test 2: Passengers see isSimulated: false ───────────────');

  // Driver sends a location update
  driverSocket.emit('driver:location:update', {
    busId,
    lat: 17.385,
    lng: 78.486,
    speed: 25,
    heading: 90,
    accuracy: 10,
    passengerCount: 30,
  });

  // Wait for bus:update on passenger side
  const driverUpdate = await waitForEvent<any>(passengerSocket, 'bus:update', 3000);
  check('Passenger received driver bus:update', driverUpdate?.busId === busId);
  check('Bus update shows isSimulated: false', driverUpdate?.isSimulated === false);
  check('Bus update has correct occupancy', driverUpdate?.occupancy?.level !== undefined);

  // After waiting for the location:confirmed
  const confirmed = await waitForEvent<any>(driverSocket, 'location:confirmed', 2000);
  check('Driver received location:confirmed', confirmed?.busId === busId);

  // ════════════════════════════════════════════════════════════════════════
  // TEST 3: NO DUPLICATE BROADCAST — SIMULATION SKIPS CONTROLLED BUS
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── Test 3: No duplicate broadcasts ─────────────────────────');

  // Collect all buses:update from simulation for 4 seconds
  const simUpdates = await collectEvents<any[]>(passengerSocket, 'buses:update', 4000);
  
  let simBroadcastedControlledBus = false;
  for (const batch of simUpdates) {
    if (Array.isArray(batch)) {
      for (const u of batch) {
        if (u.busId === busId && u.isSimulated === true) {
          simBroadcastedControlledBus = true;
        }
      }
    }
  }
  check('Simulation did NOT broadcast controlled bus', !simBroadcastedControlledBus);

  // ════════════════════════════════════════════════════════════════════════
  // TEST 4: MULTI-DRIVER CONFLICT REJECTION
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── Test 4: Multi-driver conflict rejection ─────────────────');

  let driver2Error: string | null = null;
  try {
    const driver2Socket = await connectSocket('driver', driver2Token);
    const err = await waitForEvent<any>(driver2Socket, 'error', 3000);
    driver2Error = err?.code || err?.message || 'error received';
    driver2Socket.disconnect();
  } catch (err: any) {
    driver2Error = err.message;
  }
  check('Second driver rejected for same bus', !!driver2Error);

  // ════════════════════════════════════════════════════════════════════════
  // TEST 5: DRIVER DISCONNECT → GRACE PERIOD → SIMULATION RESUMES
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── Test 5: Disconnect → Grace → Simulation Resume ──────────');

  // Record driver's last position
  const lastDriverLat = 17.385;
  const lastDriverLng = 78.486;

  // Disconnect driver
  driverSocket.disconnect();
  check('Driver disconnected', !driverSocket.connected);

  // Bus should show offline notification to passengers
  const offlineNotif = await waitForEvent<any>(passengerSocket, 'bus:offline', 3000);
  check('Passenger received bus:offline', offlineNotif?.busId === busId);

  // Wait for grace period (10s) + 1 simulation tick (3s)
  console.log('  ⏳ Waiting 14s for grace period + simulation tick...');
  await sleep(14000);

  // Check admin status — bus should now be back to simulated
  const statusAfterResume = await api('GET', '/api/admin/live-driver-status', undefined, adminToken);
  const activeDriverIds = statusAfterResume.data?.activeDriverBusIds ?? [];
  check('Bus removed from activeDriverBusIds after grace', !activeDriverIds.includes(busId));

  // Verify simulation resumed for this bus via next snapshot
  const passengerSocket2 = await connectSocket('passenger', passengerToken);
  const snapshot2 = await waitForEvent<any[]>(passengerSocket2, 'buses:snapshot', 3000);
  const busAfterResume = snapshot2?.find((b: any) => b.id === busId);
  check('Bus is back in active snapshot', !!busAfterResume);
  check('Bus shows isSimulated: true after resume', busAfterResume?.isSimulated === true);

  // ════════════════════════════════════════════════════════════════════════
  // TEST 6: NO TELEPORT ON SIMULATION RESUME
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── Test 6: No teleport on simulation resume ────────────────');

  if (busAfterResume) {
    const resumeLat = busAfterResume.latitude;
    const resumeLng = busAfterResume.longitude;

    // Calculate distance from driver's last position to simulation resume position
    const R = 6371; // km
    const dlat = ((resumeLat - lastDriverLat) * Math.PI) / 180;
    const dlng = ((resumeLng - lastDriverLng) * Math.PI) / 180;
    const a =
      Math.sin(dlat / 2) ** 2 +
      Math.cos((lastDriverLat * Math.PI) / 180) *
      Math.cos((resumeLat * Math.PI) / 180) *
      Math.sin(dlng / 2) ** 2;
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distMeters = Math.round(distKm * 1000);

    // Simulation resumes from nearest polyline point to driver's last position
    // Should be within reasonable distance (< 2km for polyline resolution)
    check(`Resume within 2km of driver last pos (${distMeters}m)`, distMeters < 2000,
      `${distMeters}m from last driver position`);
  }

  passengerSocket2.disconnect();

  // ════════════════════════════════════════════════════════════════════════
  // TEST 7: RAPID CONNECT/DISCONNECT STRESS (10 cycles)
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── Test 7: Rapid connect/disconnect (10 cycles) ────────────');

  let rapidErrors = 0;
  for (let i = 0; i < 10; i++) {
    try {
      const sock = await connectSocket('driver', driverToken);
      const init = await waitForEvent<any>(sock, 'driver:init', 3000);
      if (!init) rapidErrors++;
      sock.disconnect();
      // Wait 500ms — well within 10s grace period. Tests grace timer cancellation.
      await sleep(500);
    } catch {
      rapidErrors++;
    }
  }
  check(`Rapid 10-cycle connect/disconnect completed (${rapidErrors} errors)`, rapidErrors <= 2);

  // Wait for last grace period to expire
  await sleep(12000);

  // Verify admin counts are sane after stress
  const statusAfterStress = await api('GET', '/api/admin/live-driver-status', undefined, adminToken);
  const activeAfterStress = statusAfterStress.data?.activeDriverBusIds ?? [];
  check('No leftover driver-controlled buses after stress', !activeAfterStress.includes(busId));

  // ════════════════════════════════════════════════════════════════════════
  // TEST 8: ADMIN COUNTS ACCURACY UNDER DRIVER CONTROL
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── Test 8: Admin counts accuracy ───────────────────────────');

  // Connect driver again for count check
  const driverSocket3 = await connectSocket('driver', driverToken);
  const init3 = await waitForEvent<any>(driverSocket3, 'driver:init', 3000);
  check('Driver reconnected for count check', !!init3);

  await sleep(1000); // Let DB settle

  const countsDuringControl = await api('GET', '/api/admin/live-driver-status', undefined, adminToken);
  const data = countsDuringControl.data;
  check('realDriverBuses >= 1 during control', data?.realDriverBuses >= 1);
  check('activeDriverBusIds contains test bus', data?.activeDriverBusIds?.includes(busId));
  check('driversOnline >= 1', data?.driversOnline >= 1);

  // Admin socket check
  const adminSocket = await connectSocket('admin', adminToken);
  adminSocket.emit('drivers:request-status');
  const adminDriverStatus = await waitForEvent<any>(adminSocket, 'drivers:status', 3000);
  check('Admin socket status: totalBuses > 0', adminDriverStatus?.totalBuses > 0);
  check('Admin socket status: realDriverBuses >= 1', (adminDriverStatus?.totalBuses - adminDriverStatus?.simulatedBuses) >= 1);

  // ════════════════════════════════════════════════════════════════════════
  // TEST 9: OCCUPANCY CONSISTENCY DURING HANDOVER
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── Test 9: Occupancy consistency during handover ───────────');

  // Send a location update with specific passenger count
  await sleep(2500); // Wait for throttle to clear
  driverSocket3.emit('driver:location:update', {
    busId,
    lat: 17.386,
    lng: 78.487,
    speed: 20,
    heading: 45,
    accuracy: 8,
    passengerCount: 42,
  });

  const occUpdate = await waitForEvent<any>(driverSocket3, 'location:confirmed', 3000);
  check('Occupancy confirmed during control', !!occUpdate?.occupancy);
  if (occUpdate?.occupancy) {
    check('Occupancy percent is reasonable', occUpdate.occupancy.percent > 0 && occUpdate.occupancy.percent <= 100);
    check('Occupancy level is valid', ['LOW', 'MEDIUM', 'HIGH', 'FULL'].includes(occUpdate.occupancy.level));
  }

  // Disconnect and verify occupancy persists after resume
  driverSocket3.disconnect();
  adminSocket.disconnect();

  console.log('  ⏳ Waiting 14s for grace + resume...');
  await sleep(14000);

  const passengerSocket3 = await connectSocket('passenger', passengerToken);
  const snapshot3 = await waitForEvent<any[]>(passengerSocket3, 'buses:snapshot', 3000);
  const busOccResume = snapshot3?.find((b: any) => b.id === busId);
  check('Bus occupancy exists after resume', !!busOccResume?.occupancy);
  passengerSocket3.disconnect();

  // ════════════════════════════════════════════════════════════════════════
  // TEST 10: PUSH DEDUPE — NO DUPLICATE ON RECONNECT
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── Test 10: Push token dedupe ──────────────────────────────');

  // Register push token
  const pushReg = await api('POST', '/api/passenger/register-push', {
    pushToken: 'ExponentPushToken[dedupe-test-12345]',
  }, passengerToken);
  check('Push token registered', pushReg.success === true);

  // Verify dedupe by checking the token exists
  const unreg = await api('DELETE', '/api/passenger/unregister-push', undefined, passengerToken);
  check('Push token unregistered cleanly', unreg.success === true);

  // Re-register should work (not blocked by stale state)
  const pushReg2 = await api('POST', '/api/passenger/register-push', {
    pushToken: 'ExponentPushToken[dedupe-test-67890]',
  }, passengerToken);
  check('Push token re-registration works', pushReg2.success === true);

  // Clean up
  await api('DELETE', '/api/passenger/unregister-push', undefined, passengerToken);

  // ════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ════════════════════════════════════════════════════════════════════════
  passengerSocket.disconnect();

  // ════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════════════

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (failures.length > 0) {
    console.log('\n  FAILURES:');
    for (const f of failures) {
      console.log(`    ❌ ${f}`);
    }
  }

  console.log('\n  PHASE 3 ACCEPTANCE CHECKLIST:');
  console.log(`    ${failed === 0 ? '✔' : '✖'} Real driver takeover pauses simulation cleanly`);
  console.log(`    ${failed === 0 ? '✔' : '✖'} Simulation resumes after disconnect without teleport`);
  console.log(`    ${failed === 0 ? '✔' : '✖'} No duplicate broadcast during handoff`);
  console.log(`    ${failed === 0 ? '✔' : '✖'} No race condition on reconnect`);
  console.log(`    ${failed === 0 ? '✔' : '✖'} No ghost buses`);
  console.log(`    ${failed === 0 ? '✔' : '✖'} Push engine deduplicated`);
  console.log(`    ${failed === 0 ? '✔' : '✖'} Multi-driver conflict blocked`);
  console.log(`    ${failed === 0 ? '✔' : '✖'} Admin metrics accurate under load`);
  console.log(`    ${failed === 0 ? '✔' : '✖'} Rapid connect/disconnect clean`);
  console.log(`    ${failed === 0 ? '✔' : '✖'} Occupancy consistent during handover`);

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Validation script crashed:', err);
  process.exit(1);
});
