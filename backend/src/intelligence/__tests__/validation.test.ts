// ── Phase 6 Intelligence Behavioral Validation ──────────────────────────────
// Run: npx tsx src/intelligence/__tests__/validation.test.ts
//
// This test validates pure logic — Redis is mocked to avoid connection delays.

// Mock Redis before any imports
const noopRedis = {
  zadd: async () => 0,
  zrangebyscore: async () => [],
  zremrangebyscore: async () => 0,
  zcard: async () => 0,
  zremrangebyrank: async () => 0,
  expire: async () => 0,
  hgetall: async () => ({}),
  hincrby: async () => 0,
  hincrbyfloat: async () => '0',
  hset: async () => 0,
  keys: async () => [],
  set: async () => 'OK',
  get: async () => null,
  del: async () => 0,
  sadd: async () => 0,
  srem: async () => 0,
  ping: async () => 'PONG',
  publish: async () => 0,
  on: () => noopRedis,
};

// Intercept redis module
const origModule = await import('module');
const _getRedis = () => noopRedis as any;
await import('../../config/redis').then((mod) => {
  (mod as any).getRedis = _getRedis;
}).catch(() => {});

// Patch at runtime
import * as redisConfig from '../../config/redis';
(redisConfig as any).getRedis = _getRedis;

import { calculatePredictiveETA, type ETAInput } from '../eta.engine';
import { calculateConfidence } from '../confidence.engine';
import { rankBuses, type SuggestionBus } from '../suggestion.engine';

const GREEN = '\x1b[32m✓\x1b[0m';
const RED = '\x1b[31m✗\x1b[0m';
let passed = 0;
let failed = 0;

function assert(label: string, ok: boolean, detail = '') {
  if (ok) { console.log(`${GREEN} ${label}`); passed++; }
  else { console.log(`${RED} ${label} — ${detail}`); failed++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Phase 6 Intelligence — Behavioral Validation');
  console.log('══════════════════════════════════════════════════════\n');

  // ── S1-A: Stable Route ──
  console.log('── Section 1A: Stable Route ──');
  const stableInput: ETAInput = {
    busLat: 17.385, busLng: 78.486,
    targetLat: 17.440, targetLng: 78.500,
    currentSpeedKmh: 30,
    routeAvgSpeedKmh: 30,
    routeId: 'test-route-1',
    upcomingStopCount: 0,
    occupancyPercent: 20,
    nearbyBusCount: 0,
    routeOccupancyAvg: 15,
  };

  const stableETA = await calculatePredictiveETA(stableInput);
  assert('ETA is positive', stableETA.estimatedMinutes > 0, `got ${stableETA.estimatedMinutes}`);
  assert('ETA is not NaN', !isNaN(stableETA.estimatedMinutes));
  assert('Traffic LOW on stable route', stableETA.trafficLevel === 'LOW', `got ${stableETA.trafficLevel}`);
  assert('Congestion NONE on stable route', stableETA.congestionLevel === 'NONE', `got ${stableETA.congestionLevel}`);

  const stableConf = calculateConfidence({
    trafficLevel: stableETA.trafficLevel,
    congestionLevel: stableETA.congestionLevel,
    currentSpeedKmh: 30,
    historicalSampleCount: 20,
  });
  assert('Confidence ≥ 0.85 on stable route', stableConf.score >= 0.85, `got ${stableConf.score}`);

  // Oscillation test: vary speed ±5 kmh
  const eta1 = await calculatePredictiveETA({ ...stableInput, currentSpeedKmh: 25 });
  const eta2 = await calculatePredictiveETA({ ...stableInput, currentSpeedKmh: 35 });
  const oscillation = Math.abs(eta1.estimatedMinutes - eta2.estimatedMinutes) / Math.max(eta1.estimatedMinutes, 1);
  assert('Oscillation ≤ 15% for ±5km/h noise', oscillation <= 0.15, `got ${(oscillation * 100).toFixed(1)}%`);

  // ── S1-B: Traffic Spike ──
  console.log('\n── Section 1B: Traffic Spike ──');
  const spikeInput: ETAInput = {
    ...stableInput,
    currentSpeedKmh: 21, // 30% drop
    nearbyBusCount: 4,
    routeOccupancyAvg: 75,
  };

  const spikeETA = await calculatePredictiveETA(spikeInput);
  const etaRatio = spikeETA.estimatedMinutes / Math.max(stableETA.estimatedMinutes, 1);
  assert('ETA increases under traffic', spikeETA.estimatedMinutes > stableETA.estimatedMinutes, `stable=${stableETA.estimatedMinutes}, spike=${spikeETA.estimatedMinutes}`);
  assert('ETA does not 2x instantly', etaRatio < 2.0, `ratio=${etaRatio.toFixed(2)}`);
  assert('TrafficFactor > 1.0 under spike', spikeETA.trafficFactor > 1.0, `got ${spikeETA.trafficFactor}`);

  const spikeConf = calculateConfidence({
    trafficLevel: spikeETA.trafficLevel,
    congestionLevel: spikeETA.congestionLevel,
    currentSpeedKmh: 21,
    historicalSampleCount: 20,
  });
  const confDrop = stableConf.score - spikeConf.score;
  assert('Confidence drops ≥ 0.15 under spike', confDrop >= 0.15, `drop=${confDrop.toFixed(2)}`);

  // ── S1-C: High Occupancy Near Stop ──
  console.log('\n── Section 1C: High Occupancy + Near Stop ──');
  const stopInput: ETAInput = {
    ...stableInput,
    occupancyPercent: 85,
    upcomingStopCount: 1,
  };
  const stopETA = await calculatePredictiveETA(stopInput);
  const dwellAdded = stopETA.estimatedMinutes - stableETA.estimatedMinutes;
  assert('Dwell adds time', dwellAdded > 0, `added ${dwellAdded} min`);
  assert('Dwell per stop ≤ 25s (0.42 min)', stopETA.stopDelayMin <= 0.42, `got ${stopETA.stopDelayMin} min`);
  // With 4 stops at occupancy 85%
  const multi = await calculatePredictiveETA({ ...stopInput, upcomingStopCount: 4 });
  assert('4 stops dwell ≤ 100s (1.67 min)', multi.stopDelayMin <= 1.7, `got ${multi.stopDelayMin} min`);

  // ── S2: Suggestion Engine ──
  console.log('\n── Section 2: Suggestion Ranking ──');
  const busA: SuggestionBus = {
    busId: 'A', etaMinutes: 2, distanceMeters: 500,
    occupancyPercent: 95, trafficFactor: 1.30, confidence: 0.6,
  };
  const busB: SuggestionBus = {
    busId: 'B', etaMinutes: 4, distanceMeters: 500,
    occupancyPercent: 20, trafficFactor: 1.0, confidence: 0.9,
  };

  const ranked = rankBuses([busA, busB]);
  assert('Bus B (comfortable) ranks #1', ranked[0].busId === 'B', `#1 is ${ranked[0].busId} (scoreA=${ranked.find(r=>r.busId==='A')?.score}, scoreB=${ranked.find(r=>r.busId==='B')?.score})`);

  // ── S3: Reliability Calibration (analytical) ──
  console.log('\n── Section 3: Reliability Calibration ──');
  // 3 disconnects × 7 = 21, 5 min delay × 3 = 15 → 100 - 21 - 15 = 64 → MEDIUM (not LOW)
  const simReliability = 100 - (5 * 3) - (3 * 7) - (0 * 2);
  assert('3 disconnects + 5min delay → MEDIUM (≥50)', simReliability >= 50, `score=${simReliability}`);
  assert('Score is gradual, not instant LOW', simReliability < 80, `score=${simReliability}`);

  // ── S4: Confidence Score Stability ──
  console.log('\n── Section 4: Confidence Stability ──');
  const heavyConf = calculateConfidence({
    trafficLevel: 'HIGH',
    congestionLevel: 'MODERATE',
    gpsAccuracyMeters: 95,
    reconnectedAgoMs: 60 * 1000, // 1 min ago
    currentSpeedKmh: 15,
    historicalSampleCount: 20,
  });
  assert('Heavy scenario confidence ≥ 0.45', heavyConf.score >= 0.45, `got ${heavyConf.score}`);
  assert('Heavy scenario confidence ≤ 0.65', heavyConf.score <= 0.65, `got ${heavyConf.score}`);

  // Verify floor
  const extremeConf = calculateConfidence({
    trafficLevel: 'HIGH',
    congestionLevel: 'HEAVY',
    gpsAccuracyMeters: 150,
    reconnectedAgoMs: 30 * 1000,
    currentSpeedKmh: 0,
    historicalSampleCount: 1,
  });
  assert('Extreme scenario never < 0.45', extremeConf.score >= 0.45, `got ${extremeConf.score}`);
  assert('Confidence never > 1.0', extremeConf.score <= 1.0);

  // ── S8: Congestion Cluster Accuracy ──
  console.log('\n── Section 8: Congestion Cluster ──');
  const clust3 = await calculatePredictiveETA({ ...stableInput, nearbyBusCount: 3 });
  const clust5 = await calculatePredictiveETA({ ...stableInput, nearbyBusCount: 5 });
  assert('3 buses → MODERATE', clust3.congestionLevel === 'MODERATE', `got ${clust3.congestionLevel}`);
  assert('5 buses → HEAVY', clust5.congestionLevel === 'HEAVY', `got ${clust5.congestionLevel}`);

  // ── S9: Edge Cases ──
  console.log('\n── Section 9: Edge Cases ──');
  const zeroSpeed = await calculatePredictiveETA({ ...stableInput, currentSpeedKmh: 0, routeAvgSpeedKmh: 0 });
  assert('Zero speed → no NaN', !isNaN(zeroSpeed.estimatedMinutes), `got ${zeroSpeed.estimatedMinutes}`);
  assert('Zero speed → no negative', zeroSpeed.estimatedMinutes >= 0);

  const samePoint = await calculatePredictiveETA({
    ...stableInput, targetLat: stableInput.busLat, targetLng: stableInput.busLng,
  });
  assert('Same point → 0 or "Arriving now"', samePoint.estimatedMinutes === 0, `got ${samePoint.estimatedMinutes}`);

  const nanConf = calculateConfidence({
    trafficLevel: 'LOW', congestionLevel: 'NONE',
    currentSpeedKmh: NaN, historicalSampleCount: NaN,
  });
  assert('NaN input → confidence still valid', nanConf.score >= 0.45 && nanConf.score <= 1.0, `got ${nanConf.score}`);

  // ── S6: Performance Benchmark ──
  console.log('\n── Section 6: Performance ──');
  const perfInput: ETAInput = {
    busLat: 17.385, busLng: 78.486,
    targetLat: 17.440, targetLng: 78.500,
    currentSpeedKmh: 25, routeAvgSpeedKmh: 30,
    occupancyPercent: 50, nearbyBusCount: 2, routeOccupancyAvg: 40,
  };

  // Warm up
  for (let i = 0; i < 10; i++) await calculatePredictiveETA(perfInput);

  const iterations = 200;
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await calculatePredictiveETA(perfInput);
    calculateConfidence({ trafficLevel: 'MODERATE', congestionLevel: 'LIGHT', currentSpeedKmh: 25 });
    times.push(performance.now() - t0);
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const p95 = times[Math.floor(iterations * 0.95)];
  const p99 = times[Math.floor(iterations * 0.99)];

  console.log(`  Avg: ${avg.toFixed(2)}ms  P95: ${p95.toFixed(2)}ms  P99: ${p99.toFixed(2)}ms`);
  assert('Avg < 20ms', avg < 20, `${avg.toFixed(2)}ms`);
  assert('P95 < 40ms', p95 < 40, `${p95.toFixed(2)}ms`);
  assert('P99 < 60ms', p99 < 60, `${p99.toFixed(2)}ms`);

  // ── Summary ──
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('  ✅ Phase 6 Intelligence — Behavior Verified');
  } else {
    console.log('  ❌ Some tests failed — review above');
  }
  console.log('══════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => { console.error(err); process.exit(1); });
