/**
 * HydGo Stress Test
 *
 * Spawns 200 passenger + 20 driver Socket.io connections and measures:
 * - Connection success rate
 * - Average message latency
 * - Error rate
 *
 * Usage:
 *   npx ts-node scripts/stress-test.ts [--url http://localhost:3000] [--token <jwt>]
 */

import { io, Socket } from 'socket.io-client';

// ── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1] ?? 'http://localhost:3000';
const TOKEN = process.argv.find((a) => a.startsWith('--token='))?.split('=')[1] ?? '';

const PASSENGER_COUNT = 200;
const DRIVER_COUNT = 20;
const TEST_DURATION_MS = 120_000;
const EMIT_INTERVAL_MS = 3_000;

// Hyderabad bounding box
const HYD_LAT_MIN = 17.3;
const HYD_LAT_MAX = 17.5;
const HYD_LNG_MIN = 78.4;
const HYD_LNG_MAX = 78.55;

// ── Stats ───────────────────────────────────────────────────────────────────

interface Stats {
  connectSuccess: number;
  connectFailed: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  latencies: number[];
}

const stats: Stats = {
  connectSuccess: 0,
  connectFailed: 0,
  messagesSent: 0,
  messagesReceived: 0,
  errors: 0,
  latencies: [],
};

const allSockets: Socket[] = [];

// ── Helpers ─────────────────────────────────────────────────────────────────

function randomLat(): number {
  return HYD_LAT_MIN + Math.random() * (HYD_LAT_MAX - HYD_LAT_MIN);
}

function randomLng(): number {
  return HYD_LNG_MIN + Math.random() * (HYD_LNG_MAX - HYD_LNG_MIN);
}

function createSocket(namespace: string): Socket {
  const socket = io(`${BASE_URL}${namespace}`, {
    auth: { token: TOKEN },
    transports: ['websocket'],
    reconnection: false,
    timeout: 10_000,
  });

  socket.on('connect', () => {
    stats.connectSuccess++;
  });

  socket.on('connect_error', (err) => {
    stats.connectFailed++;
    stats.errors++;
  });

  socket.on('error', () => {
    stats.errors++;
  });

  allSockets.push(socket);
  return socket;
}

// ── Passenger simulation ────────────────────────────────────────────────────

function spawnPassenger(): void {
  const socket = createSocket('/passenger');

  socket.on('buses:nearby', (data) => {
    stats.messagesReceived++;
    // Measure round-trip latency (stored in the data)
    const sentAt = (socket as any).__lastSent;
    if (sentAt) {
      stats.latencies.push(Date.now() - sentAt);
    }
  });

  const interval = setInterval(() => {
    if (!socket.connected) return;
    (socket as any).__lastSent = Date.now();
    socket.emit('location:send', { latitude: randomLat(), longitude: randomLng() });
    stats.messagesSent++;
  }, EMIT_INTERVAL_MS + Math.random() * 1000);

  socket.on('disconnect', () => clearInterval(interval));
}

// ── Driver simulation ───────────────────────────────────────────────────────

function spawnDriver(): void {
  const socket = createSocket('/driver');

  socket.on('location:confirmed', () => {
    stats.messagesReceived++;
  });

  const interval = setInterval(() => {
    if (!socket.connected) return;
    socket.emit('location:update', {
      latitude: randomLat(),
      longitude: randomLng(),
      heading: Math.random() * 360,
      speed: 15 + Math.random() * 35,
    });
    stats.messagesSent++;
  }, EMIT_INTERVAL_MS);

  socket.on('disconnect', () => clearInterval(interval));
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════');
  console.log('  HydGo Stress Test');
  console.log('═══════════════════════════════════════════════');
  console.log(`Target:       ${BASE_URL}`);
  console.log(`Passengers:   ${PASSENGER_COUNT}`);
  console.log(`Drivers:      ${DRIVER_COUNT}`);
  console.log(`Duration:     ${TEST_DURATION_MS / 1000}s`);
  console.log(`Auth token:   ${TOKEN ? 'provided' : 'NONE (connections will fail auth)'}`);
  console.log('───────────────────────────────────────────────');
  console.log('Spawning connections…\n');

  // Stagger connection to avoid thundering herd
  for (let i = 0; i < PASSENGER_COUNT; i++) {
    spawnPassenger();
    if (i % 50 === 49) await sleep(500);
  }

  for (let i = 0; i < DRIVER_COUNT; i++) {
    spawnDriver();
    if (i % 10 === 9) await sleep(200);
  }

  console.log(`All ${PASSENGER_COUNT + DRIVER_COUNT} sockets created. Waiting for test period…\n`);

  // Progress updates
  const progressInterval = setInterval(() => {
    console.log(
      `[Progress] Connected: ${stats.connectSuccess} | Failed: ${stats.connectFailed} | ` +
        `Sent: ${stats.messagesSent} | Received: ${stats.messagesReceived} | Errors: ${stats.errors}`,
    );
  }, 5_000);

  await sleep(TEST_DURATION_MS);

  clearInterval(progressInterval);

  // Disconnect all
  console.log('\nDisconnecting all sockets…');
  for (const s of allSockets) {
    s.disconnect();
  }

  await sleep(1_000);

  // Report
  const avgLatency =
    stats.latencies.length > 0
      ? Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length)
      : 0;

  const p95 = stats.latencies.length > 0 ? percentile(stats.latencies, 95) : 0;
  const p99 = stats.latencies.length > 0 ? percentile(stats.latencies, 99) : 0;

  console.log('\n═══════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════');
  console.log(`Connections succeeded:  ${stats.connectSuccess}`);
  console.log(`Connections failed:     ${stats.connectFailed}`);
  console.log(`Messages sent:          ${stats.messagesSent}`);
  console.log(`Messages received:      ${stats.messagesReceived}`);
  console.log(`Errors:                 ${stats.errors}`);
  console.log(`Avg latency:            ${avgLatency} ms`);
  console.log(`P95 latency:            ${p95} ms`);
  console.log(`P99 latency:            ${p99} ms`);
  console.log('═══════════════════════════════════════════════');

  const successRate = stats.connectSuccess / (PASSENGER_COUNT + DRIVER_COUNT);
  if (successRate < 0.95) {
    console.log('\n⚠ WARNING: Connection success rate below 95%');
  }
  if (avgLatency > 500) {
    console.log('\n⚠ WARNING: Average latency exceeds 500ms');
  }
  if (stats.errors > 10) {
    console.log('\n⚠ WARNING: Error count exceeds threshold');
  }

  process.exit(0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── Run ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
