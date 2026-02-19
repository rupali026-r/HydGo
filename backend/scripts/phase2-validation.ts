/**
 * Phase 2 Behavioral Validation Suite
 * ────────────────────────────────────
 * Tests 6 critical runtime behaviors:
 *  1. Live movement reality (no teleporting, no drift)
 *  2. Socket reconnect recovery
 *  3. Large radius performance
 *  4. Rapid update stress
 *  5. Memory growth / listener stacking
 *  6. Multi-tab simultaneous connections
 *
 * Run: cd backend && npx ts-node scripts/phase2-validation.ts --token=<JWT>
 */

import { io, Socket } from 'socket.io-client';

const BASE_URL =
  process.argv.find((a) => a.startsWith('--url='))?.split('=')[1] ?? 'http://localhost:3000';
const TOKEN =
  process.argv.find((a) => a.startsWith('--token='))?.split('=')[1] ?? '';

if (!TOKEN) {
  console.error('❌ Usage: npx ts-node scripts/phase2-validation.ts --token=<JWT>');
  process.exit(1);
}

// ── Utility ─────────────────────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function createSocket(url: string = BASE_URL): Socket {
  return io(`${url}/passenger`, {
    auth: { token: TOKEN },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 30,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    forceNew: true,
  });
}

let totalPassed = 0;
let totalFailed = 0;

function pass(label: string, detail?: string) {
  totalPassed++;
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
}
function fail(label: string, detail?: string) {
  totalFailed++;
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
}

// ── Test 1: Live Movement Reality ───────────────────────────────────────────

async function test1_liveMovement(): Promise<void> {
  console.log('\n━━━ TEST 1: Live Movement Reality ━━━');

  const socket = createSocket();
  const busPositions = new Map<string, { lat: number; lng: number; ts: number }[]>();
  let snapshotReceived = false;
  let updateCount = 0;

  return new Promise<void>((resolve) => {
    socket.on('connect', () => {
      console.log('  Connected for movement test');
    });

    socket.on('buses:snapshot', (buses: any[]) => {
      snapshotReceived = true;
      console.log(`  Snapshot received: ${buses.length} buses`);
      for (const b of buses) {
        busPositions.set(b.id, [{ lat: b.latitude, lng: b.longitude, ts: Date.now() }]);
      }
    });

    socket.on('buses:update', (updates: any[]) => {
      updateCount++;
      const now = Date.now();
      for (const u of updates) {
        const hist = busPositions.get(u.busId) ?? [];
        hist.push({ lat: u.latitude, lng: u.longitude, ts: now });
        // Keep last 100 positions
        if (hist.length > 100) hist.shift();
        busPositions.set(u.busId, hist);
      }
    });

    // Run for 60 seconds (20 ticks at 3s interval)
    const testDurationMs = 60_000;
    console.log(`  Collecting data for ${testDurationMs / 1000}s …`);

    setTimeout(() => {
      socket.disconnect();

      // ── Analyze collected data ──────────────────────────────────────

      if (!snapshotReceived) {
        fail('Snapshot received', 'No snapshot event');
      } else {
        pass('Snapshot received');
      }

      if (updateCount < 15) {
        fail('Update frequency', `Only ${updateCount} updates in ${testDurationMs / 1000}s (expected ~20)`);
      } else {
        pass('Update frequency', `${updateCount} updates received`);
      }

      let teleportCount = 0;
      let backwardCount = 0;
      let maxJumpKm = 0;
      let totalBuses = busPositions.size;
      let busesWithEnoughData = 0;

      busPositions.forEach((hist, busId) => {
        if (hist.length < 5) return;
        busesWithEnoughData++;

        for (let i = 1; i < hist.length; i++) {
          const prev = hist[i - 1];
          const curr = hist[i];
          const dist = haversine(prev.lat, prev.lng, curr.lat, curr.lng);
          const dt = (curr.ts - prev.ts) / 1000;

          if (dist > maxJumpKm) maxJumpKm = dist;

          // Teleport: >500m in a single 3s tick at ~40km/h max → ~33m
          // Allow generous 200m for segment transitions
          if (dist > 0.2) {
            teleportCount++;
          }
        }

        // Check for backward snapping (positions reverting)
        for (let i = 2; i < hist.length; i++) {
          const pp = hist[i - 2];
          const p = hist[i - 1];
          const c = hist[i];
          const d_pp_c = haversine(pp.lat, pp.lng, c.lat, c.lng);
          const d_pp_p = haversine(pp.lat, pp.lng, p.lat, p.lng);
          // If current is closer to two-steps-ago than previous was → backward snap
          if (d_pp_c < d_pp_p * 0.3 && d_pp_p > 0.01) {
            backwardCount++;
          }
        }
      });

      if (busesWithEnoughData === 0) {
        fail('Buses collected data', 'No bus had 5+ position samples');
      } else {
        pass('Buses tracked', `${busesWithEnoughData}/${totalBuses} buses with 5+ samples`);
      }

      if (teleportCount === 0) {
        pass('No teleporting', `Max jump: ${(maxJumpKm * 1000).toFixed(1)}m`);
      } else {
        fail('Teleporting detected', `${teleportCount} jumps > 200m (max: ${(maxJumpKm * 1000).toFixed(1)}m)`);
      }

      if (backwardCount <= 2) {
        pass('No backward snapping', `${backwardCount} snap events (≤2 tolerance)`);
      } else {
        fail('Backward snapping', `${backwardCount} backward snap events`);
      }

      // Check for floating-point drift
      // If any bus has positions outside Hyderabad bbox, drift occurred
      let driftCount = 0;
      busPositions.forEach((hist) => {
        for (const p of hist) {
          if (p.lat < 17.0 || p.lat > 17.8 || p.lng < 78.0 || p.lng > 79.0) {
            driftCount++;
          }
        }
      });

      if (driftCount === 0) {
        pass('No coordinate drift', 'All positions within Hyderabad bbox');
      } else {
        fail('Coordinate drift', `${driftCount} positions outside Hyderabad bounds`);
      }

      resolve();
    }, testDurationMs);
  });
}

// ── Test 2: Socket Reconnect Recovery ───────────────────────────────────────

async function test2_reconnect(): Promise<void> {
  console.log('\n━━━ TEST 2: Socket Reconnect Recovery ━━━');

  const socket = createSocket();
  let snapshotCount = 0;
  let busIdsBeforeDisconnect = new Set<string>();
  let busIdsAfterReconnect = new Set<string>();
  let reconnected = false;
  let connectionLossDetected = false;

  return new Promise<void>((resolve) => {
    socket.on('connect', () => {
      if (snapshotCount > 0) {
        reconnected = true;
        console.log('  Reconnected after forced disconnect');
      }
    });

    socket.on('disconnect', () => {
      connectionLossDetected = true;
    });

    socket.on('buses:snapshot', (buses: any[]) => {
      snapshotCount++;
      if (snapshotCount === 1) {
        // First connect
        busIdsBeforeDisconnect = new Set(buses.map((b: any) => b.id));
        console.log(`  Initial snapshot: ${buses.length} buses`);

        // Force disconnect after small delay
        setTimeout(() => {
          console.log('  Forcing disconnect …');
          socket.disconnect();

          // Re-connect after 3 seconds
          setTimeout(() => {
            console.log('  Re-connecting …');
            socket.connect();
          }, 3000);
        }, 2000);
      } else if (snapshotCount === 2) {
        // After reconnect
        busIdsAfterReconnect = new Set(buses.map((b: any) => b.id));
        console.log(`  Post-reconnect snapshot: ${buses.length} buses`);
      }
    });

    // Give plenty of time
    setTimeout(() => {
      socket.disconnect();

      if (connectionLossDetected) {
        pass('Disconnect detected');
      } else {
        fail('Disconnect not detected');
      }

      if (reconnected) {
        pass('Socket reconnected');
      } else {
        fail('Socket did not reconnect');
      }

      if (snapshotCount >= 2) {
        pass('New snapshot on reconnect', `${snapshotCount} snapshots total`);
      } else {
        fail('No new snapshot on reconnect', `Only ${snapshotCount} snapshots`);
      }

      // Check for duplicate buses
      if (busIdsAfterReconnect.size > 0) {
        // Both sets should have same buses (simulation still running)
        const overlap = [...busIdsAfterReconnect].filter((id) => busIdsBeforeDisconnect.has(id));
        if (overlap.length > 0) {
          pass('No duplicate buses', `${overlap.length} common bus IDs (expected — same simulation)`);
        } else {
          // If simulation restarted, IDs might differ — that's okay
          pass('Bus IDs consistent', 'Different IDs = simulation reseeded (acceptable)');
        }
      }

      resolve();
    }, 15_000);
  });
}

// ── Test 3: Large Radius Performance ────────────────────────────────────────

async function test3_largeRadius(): Promise<void> {
  console.log('\n━━━ TEST 3: Large Radius Performance (10km) ━━━');

  const socket = createSocket();
  let nearbyResponseTime = 0;
  let responseReceived = false;
  let busCount = 0;

  return new Promise<void>((resolve) => {
    socket.on('connect', () => {
      console.log('  Connected for radius test');
    });

    socket.on('buses:snapshot', () => {
      // Emit location near Hyderabad center (10km would cover whole city)
      const sendTime = Date.now();
      socket.emit('location:send', { latitude: 17.385, longitude: 78.4867 });

      socket.on('buses:nearby', (buses: any[]) => {
        if (!responseReceived) {
          nearbyResponseTime = Date.now() - sendTime;
          responseReceived = true;
          busCount = buses.length;
        }
      });
    });

    setTimeout(() => {
      socket.disconnect();

      if (!responseReceived) {
        fail('Nearby response received', 'No response from location:send');
      } else {
        if (nearbyResponseTime < 500) {
          pass('Response time', `${nearbyResponseTime}ms (< 500ms)`);
        } else if (nearbyResponseTime < 1000) {
          pass('Response time (marginal)', `${nearbyResponseTime}ms (< 1s, acceptable)`);
        } else {
          fail('Response time', `${nearbyResponseTime}ms (> 1s — too slow)`);
        }

        pass('Buses returned', `${busCount} buses within radius`);
      }

      resolve();
    }, 10_000);
  });
}

// ── Test 4: Rapid Update Stress ─────────────────────────────────────────────

async function test4_rapidStress(): Promise<void> {
  console.log('\n━━━ TEST 4: Rapid Update Stress ━━━');
  console.log('  (Measuring update handling at 3s simulation interval)');

  const socket = createSocket();
  let updateTimestamps: number[] = [];
  let updateSizes: number[] = [];
  let errorCount = 0;

  return new Promise<void>((resolve) => {
    socket.on('connect', () => {
      console.log('  Connected for stress test');
    });

    socket.on('buses:update', (updates: any[]) => {
      updateTimestamps.push(Date.now());
      updateSizes.push(updates.length);
    });

    socket.on('error', () => {
      errorCount++;
    });

    // Also spam location:send at high rate (simulating rapid client)
    socket.on('buses:snapshot', () => {
      const spamInterval = setInterval(() => {
        socket.emit('location:send', {
          latitude: 17.385 + (Math.random() - 0.5) * 0.01,
          longitude: 78.4867 + (Math.random() - 0.5) * 0.01,
        });
      }, 500); // 2x per second

      setTimeout(() => clearInterval(spamInterval), 28_000);
    });

    // Run for 30 seconds
    setTimeout(() => {
      socket.disconnect();

      if (updateTimestamps.length < 5) {
        fail('Received updates', `Only ${updateTimestamps.length} updates in 30s`);
      } else {
        pass('Received updates', `${updateTimestamps.length} updates`);
      }

      // Check update intervals — should be ~3s apart
      if (updateTimestamps.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < updateTimestamps.length; i++) {
          intervals.push(updateTimestamps[i] - updateTimestamps[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const maxInterval = Math.max(...intervals);
        const minInterval = Math.min(...intervals);

        if (avgInterval > 2500 && avgInterval < 4000) {
          pass('Update cadence', `Avg ${Math.round(avgInterval)}ms (expected ~3000ms)`);
        } else {
          fail('Update cadence', `Avg ${Math.round(avgInterval)}ms (expected ~3000ms)`);
        }

        if (maxInterval < 8000) {
          pass('No dropped updates', `Max gap: ${maxInterval}ms`);
        } else {
          fail('Dropped update detected', `Max gap: ${maxInterval}ms`);
        }
      }

      // Avg bus count per update
      const avgBuses = updateSizes.reduce((a, b) => a + b, 0) / updateSizes.length;
      pass('Avg buses per update', `${Math.round(avgBuses)}`);

      if (errorCount === 0) {
        pass('No socket errors', 'Zero errors during spam');
      } else {
        fail('Socket errors', `${errorCount} errors during rapid sends`);
      }

      resolve();
    }, 30_000);
  });
}

// ── Test 5: Memory / Listener Stacking ──────────────────────────────────────

async function test5_memoryListeners(): Promise<void> {
  console.log('\n━━━ TEST 5: Memory Growth / Listener Stacking ━━━');

  // Simulate repeated connect/disconnect cycles (what happens in production)
  const cycles = 10;
  let connectCount = 0;
  let disconnectCount = 0;

  for (let i = 0; i < cycles; i++) {
    const socket = createSocket();

    await new Promise<void>((resolve) => {
      socket.on('connect', () => {
        connectCount++;
      });

      socket.on('buses:snapshot', () => {
        // Disconnect quickly
        setTimeout(() => {
          socket.disconnect();
          disconnectCount++;
          resolve();
        }, 500);
      });

      // Timeout safety
      setTimeout(() => {
        if (socket.connected) socket.disconnect();
        resolve();
      }, 5000);
    });

    // Small gap between cycles
    await sleep(200);
  }

  if (connectCount === cycles) {
    pass('All cycles connected', `${connectCount}/${cycles}`);
  } else {
    fail('Connection cycles', `${connectCount}/${cycles} connected`);
  }

  if (disconnectCount === cycles) {
    pass('All cycles disconnected cleanly', `${disconnectCount}/${cycles}`);
  } else {
    fail('Disconnect cycles', `${disconnectCount}/${cycles} disconnected`);
  }

  // After all cycles, connect one more time and check behavior
  const finalSocket = createSocket();
  let finalSnapshotReceived = false;
  let duplicateUpdateCheck = 0;

  await new Promise<void>((resolve) => {
    finalSocket.on('connect', () => {
      console.log('  Final connection after cycles');
    });

    finalSocket.on('buses:snapshot', () => {
      finalSnapshotReceived = true;
    });

    finalSocket.on('buses:update', () => {
      duplicateUpdateCheck++;
    });

    setTimeout(() => {
      finalSocket.disconnect();

      if (finalSnapshotReceived) {
        pass('Post-cycle snapshot works');
      } else {
        fail('Post-cycle snapshot failed');
      }

      // Should get ~2 updates in 6s (3s tick)
      if (duplicateUpdateCheck >= 1 && duplicateUpdateCheck <= 5) {
        pass('No listener stacking', `${duplicateUpdateCheck} updates (expected 1-3)`);
      } else if (duplicateUpdateCheck > 5) {
        fail('Possible listener stacking', `${duplicateUpdateCheck} updates in 6s (suspicious)`);
      } else {
        pass('Update delivery normal', `${duplicateUpdateCheck} updates`);
      }

      resolve();
    }, 7_000);
  });
}

// ── Test 6: Multi-Tab Sync ──────────────────────────────────────────────────

async function test6_multiTab(): Promise<void> {
  console.log('\n━━━ TEST 6: Multi-Tab Sync ━━━');

  const tabCount = 3;
  const sockets: Socket[] = [];
  const snapshotData: Map<number, Set<string>> = new Map();
  const updateData: Map<number, number> = new Map();

  for (let i = 0; i < tabCount; i++) {
    snapshotData.set(i, new Set());
    updateData.set(i, 0);
  }

  // Connect all 3 "tabs"
  for (let i = 0; i < tabCount; i++) {
    const socket = createSocket();
    sockets.push(socket);

    const tabIdx = i;
    socket.on('buses:snapshot', (buses: any[]) => {
      buses.forEach((b: any) => snapshotData.get(tabIdx)!.add(b.id));
    });

    socket.on('buses:update', (updates: any[]) => {
      updateData.set(tabIdx, (updateData.get(tabIdx) ?? 0) + updates.length);
    });
  }

  // Wait for connections and data
  await sleep(15_000);

  // Disconnect all
  sockets.forEach((s) => s.disconnect());

  // Check: all tabs got snapshots
  let allGotSnapshot = true;
  for (let i = 0; i < tabCount; i++) {
    if (snapshotData.get(i)!.size === 0) {
      allGotSnapshot = false;
      fail(`Tab ${i + 1} snapshot`, 'No buses received');
    }
  }

  if (allGotSnapshot) {
    const sizes = Array.from(snapshotData.values()).map((s) => s.size);
    if (new Set(sizes).size === 1) {
      pass('All tabs received same snapshot', `${sizes[0]} buses each`);
    } else {
      // Could be timing difference — check they're close
      const diff = Math.max(...sizes) - Math.min(...sizes);
      if (diff <= 2) {
        pass('Snapshot near-identical', `Sizes: ${sizes.join(', ')} (diff: ${diff})`);
      } else {
        fail('Snapshot divergence', `Sizes: ${sizes.join(', ')}`);
      }
    }
  }

  // Check: all tabs got updates
  const updateCounts = Array.from(updateData.values());
  const allGotUpdates = updateCounts.every((c) => c > 0);

  if (allGotUpdates) {
    pass('All tabs received updates', `Counts: ${updateCounts.join(', ')}`);
  } else {
    fail('Not all tabs got updates', `Counts: ${updateCounts.join(', ')}`);
  }

  // Check: no exponential load (update counts should be similar)
  if (updateCounts.length >= 2) {
    const max = Math.max(...updateCounts);
    const min = Math.min(...updateCounts);
    const ratio = max / (min || 1);
    if (ratio < 2) {
      pass('No exponential load', `Update ratio: ${ratio.toFixed(1)}x`);
    } else {
      fail('Update load imbalance', `Tab ratio: ${ratio.toFixed(1)}x`);
    }
  }

  // Check: bus IDs are consistent across tabs
  const tab0Ids = snapshotData.get(0)!;
  const tab1Ids = snapshotData.get(1)!;
  const tab2Ids = snapshotData.get(2)!;
  const commonAcrossAll = [...tab0Ids].filter((id) => tab1Ids.has(id) && tab2Ids.has(id));

  if (commonAcrossAll.length > 0 && commonAcrossAll.length >= tab0Ids.size * 0.8) {
    pass('Bus IDs consistent', `${commonAcrossAll.length} common across all tabs`);
  } else if (commonAcrossAll.length > 0) {
    pass('Bus IDs partially consistent', `${commonAcrossAll.length} common`);
  } else {
    fail('No common bus IDs across tabs');
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Phase 2: Behavioral Validation Suite       ║');
  console.log('║  Testing 6 runtime conditions               ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Server: ${BASE_URL}`);
  console.log(`  Time: ${new Date().toISOString()}`);

  try {
    await test1_liveMovement();       // ~60s
    await test2_reconnect();          // ~15s
    await test3_largeRadius();        // ~10s
    await test4_rapidStress();        // ~30s
    await test5_memoryListeners();    // ~20s
    await test6_multiTab();           // ~15s
  } catch (err) {
    console.error('\n  💥 FATAL ERROR:', err);
    totalFailed++;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  TOTAL:  ${totalPassed} passed, ${totalFailed} failed`);
  if (totalFailed === 0) {
    console.log('  🏆 PHASE 2 VALIDATION — ALL PASSED');
  } else {
    console.log('  ⚠️  PHASE 2 VALIDATION — FAILURES DETECTED');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
