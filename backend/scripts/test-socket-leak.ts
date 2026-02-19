/**
 * Test 5: Socket Leak Detection
 *
 * 1. Get baseline socket count (should be 0)
 * 2. Connect 50 passenger sockets
 * 3. Verify metrics shows 50 sockets
 * 4. Disconnect all 50 sockets
 * 5. Verify metrics shows 0 sockets (no leaks)
 */

import { io, Socket } from 'socket.io-client';

const BASE = 'http://localhost:3000';
const unique = Date.now();
const NUM_SOCKETS = 50;

async function api(path: string, body?: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = await fetch(`${BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return resp.json() as Promise<any>;
}

async function getMetrics(adminToken: string) {
  return api('/api/admin/system-metrics', undefined, adminToken);
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
  console.log('=== Test 5: Socket Leak Detection ===\n');

  // Register admin user
  console.log('[1] Setting up admin user...');
  const adminReg = await api('/api/auth/register', {
    name: `Admin${unique}`,
    email: `admin${unique}@test.com`,
    password: 'Test1234!',
    role: 'ADMIN',
    adminSecretKey: 'TSRTC-HYDGO-ADMIN-2026-SECURE',
  });
  if (!adminReg.data?.accessToken) {
    console.error('Admin registration failed:', JSON.stringify(adminReg));
    process.exit(1);
  }
  const adminToken = adminReg.data.accessToken;
  console.log('    ✓ Admin registered');

  // Register passenger for socket connections
  const passengerReg = await api('/api/auth/register', {
    name: `SocketTestPass${unique}`,
    email: `socketpass${unique}@test.com`,
    password: 'Test1234!',
    role: 'PASSENGER',
  });
  const passengerToken = passengerReg.data?.accessToken;
  console.log('    ✓ Passenger registered');

  // Step 1: Baseline metrics
  console.log('\n[2] Baseline socket count...');
  const baseline = await getMetrics(adminToken);
  const baselineSockets = baseline.data?.sockets;
  console.log(`    Passengers: ${baselineSockets?.passengers}, Drivers: ${baselineSockets?.drivers}, Admins: ${baselineSockets?.admins}`);

  // Step 2: Connect 50 passenger sockets
  console.log(`\n[3] Connecting ${NUM_SOCKETS} passenger sockets...`);
  const sockets: Socket[] = [];
  for (let i = 0; i < NUM_SOCKETS; i++) {
    try {
      const s = await connectSocket('/passenger', passengerToken);
      sockets.push(s);
    } catch (err) {
      console.error(`    Socket ${i + 1} failed:`, err);
    }
  }
  console.log(`    ✓ ${sockets.length}/${NUM_SOCKETS} sockets connected`);

  // Step 3: Check metrics with sockets connected
  console.log('\n[4] Socket count with connections...');
  const duringMetrics = await getMetrics(adminToken);
  const duringSockets = duringMetrics.data?.sockets;
  console.log(`    Passengers: ${duringSockets?.passengers}, Drivers: ${duringSockets?.drivers}, Admins: ${duringSockets?.admins}`);

  // Step 4: Disconnect all sockets
  console.log(`\n[5] Disconnecting all ${sockets.length} sockets...`);
  for (const s of sockets) {
    s.disconnect();
  }

  // Wait for server to process disconnects
  await new Promise((r) => setTimeout(r, 3000));

  // Step 5: Check metrics after disconnect
  console.log('\n[6] Socket count after disconnect...');
  const afterMetrics = await getMetrics(adminToken);
  const afterSockets = afterMetrics.data?.sockets;
  console.log(`    Passengers: ${afterSockets?.passengers}, Drivers: ${afterSockets?.drivers}, Admins: ${afterSockets?.admins}`);

  // Assertions
  console.log('\n=== RESULTS ===');
  const connectedOk = duringSockets?.passengers >= NUM_SOCKETS;
  const leakFree = afterSockets?.passengers === (baselineSockets?.passengers ?? 0);
  const driversZero = afterSockets?.drivers === (baselineSockets?.drivers ?? 0);

  console.log(`[✓] ${NUM_SOCKETS} sockets connected: ${connectedOk ? 'PASS' : 'FAIL'} (saw: ${duringSockets?.passengers})`);
  console.log(`[✓] Post-disconnect passengers = baseline: ${leakFree ? 'PASS' : 'FAIL'} (baseline: ${baselineSockets?.passengers ?? 0}, after: ${afterSockets?.passengers})`);
  console.log(`[✓] No driver socket leak: ${driversZero ? 'PASS' : 'FAIL'} (baseline: ${baselineSockets?.drivers ?? 0}, after: ${afterSockets?.drivers})`);

  const allPassed = connectedOk && leakFree && driversZero;
  console.log(`\n=== Test 5 ${allPassed ? 'PASSED ✓' : 'FAILED ✗'} ===`);

  process.exit(allPassed ? 0 : 1);
}

main();
