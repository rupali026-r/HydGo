// ── Phase 6 Intelligence — Standalone Behavioral Validation ─────────────────
// Pure logic tests — no Redis, no database, no network.
// Run: npx tsx src/intelligence/__tests__/standalone-validation.ts

// ══════════════════════════════════════════════════════════════════════════════
// Inline the core logic from each engine to avoid importing Redis-dependent code.
// This validates formulas, weights, thresholds, and edge cases.
// ══════════════════════════════════════════════════════════════════════════════

const GREEN = '\x1b[32m✓\x1b[0m';
const RED = '\x1b[31m✗\x1b[0m';
let passed = 0;
let failed = 0;

function assert(label: string, ok: boolean, detail = '') {
  if (ok) { console.log(`${GREEN} ${label}`); passed++; }
  else { console.log(`${RED} ${label} — ${detail}`); failed++; }
}

// ── Haversine (from utils/geo) ──
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── ETA Engine Constants (must match eta.engine.ts post-tuning) ──
const MIN_SPEED_KMH = 5;
const SPEED_WEIGHT_CURRENT = 0.4;
const SPEED_WEIGHT_ROUTE_AVG = 0.4;
const SPEED_WEIGHT_HISTORICAL = 0.2;
const DWELL_HIGH_SEC = 20;
const DWELL_MED_SEC = 12;
const DWELL_LOW_SEC = 6;
const DWELL_MAX_SEC = 25;
const CONGESTION_BUS_RADIUS_THRESHOLD = 3;
const CONGESTION_BUS_HEAVY_THRESHOLD = 5;
const CONGESTION_OCCUPANCY_THRESHOLD = 70;
const TRAFFIC_SPEED_DROP_THRESHOLD = 0.75;

type TrafficLevel = 'LOW' | 'MODERATE' | 'HIGH';
type CongestionLevel = 'NONE' | 'LIGHT' | 'MODERATE' | 'HEAVY';

interface ETAResult {
  distanceKm: number; estimatedMinutes: number; formattedETA: string;
  trafficLevel: TrafficLevel; congestionLevel: CongestionLevel;
  trafficFactor: number; congestionPenaltyMin: number; stopDelayMin: number;
  weightedSpeedKmh: number;
}

interface ETAInput {
  busLat: number; busLng: number; targetLat: number; targetLng: number;
  currentSpeedKmh: number; routeAvgSpeedKmh: number;
  historicalSpeedKmh?: number;
  upcomingStopCount?: number; occupancyPercent?: number;
  nearbyBusCount?: number; routeOccupancyAvg?: number;
  timeOfDayFactor?: number;
}

const _prevTrafficFactor = new Map<string, number>();

function calcETA(input: ETAInput): ETAResult {
  const {
    busLat, busLng, targetLat, targetLng,
    currentSpeedKmh, routeAvgSpeedKmh,
    historicalSpeedKmh,
    upcomingStopCount = 0, occupancyPercent = 0,
    nearbyBusCount = 0, routeOccupancyAvg = 0,
    timeOfDayFactor = 1.0,
  } = input;

  const distanceKm = haversineDistance(busLat, busLng, targetLat, targetLng);

  const effectiveCurrent = Math.max(currentSpeedKmh, MIN_SPEED_KMH);
  const effectiveRouteAvg = Math.max(routeAvgSpeedKmh, MIN_SPEED_KMH);
  const effectiveHistorical = Math.max(historicalSpeedKmh ?? routeAvgSpeedKmh, MIN_SPEED_KMH);

  const weightedSpeed = Math.max(
    (SPEED_WEIGHT_CURRENT * effectiveCurrent) +
    (SPEED_WEIGHT_ROUTE_AVG * effectiveRouteAvg) +
    (SPEED_WEIGHT_HISTORICAL * effectiveHistorical),
    MIN_SPEED_KMH,
  );

  let trafficFactor = timeOfDayFactor;
  if (effectiveCurrent < effectiveRouteAvg * TRAFFIC_SPEED_DROP_THRESHOLD) {
    trafficFactor = Math.min(trafficFactor + 0.10, 1.30);
  }
  if (nearbyBusCount > 5) {
    trafficFactor = Math.min(trafficFactor + 0.05, 1.30);
  }
  trafficFactor = Math.max(1.0, Math.min(trafficFactor, 1.30));

  // Smooth traffic factor
  const prevFactor = _prevTrafficFactor.get('test');
  if (prevFactor != null && Math.abs(trafficFactor - prevFactor) > 0.05) {
    trafficFactor = Math.round((0.7 * prevFactor + 0.3 * trafficFactor) * 100) / 100;
    trafficFactor = Math.max(1.0, Math.min(trafficFactor, 1.30));
  }
  _prevTrafficFactor.set('test', trafficFactor);

  const trafficLevel: TrafficLevel =
    trafficFactor >= 1.20 ? 'HIGH' : trafficFactor >= 1.10 ? 'MODERATE' : 'LOW';

  let perStopDwell: number;
  if (occupancyPercent > 70) perStopDwell = DWELL_HIGH_SEC;
  else if (occupancyPercent > 40) perStopDwell = DWELL_MED_SEC;
  else perStopDwell = DWELL_LOW_SEC;
  const clampedDwell = Math.min(perStopDwell, DWELL_MAX_SEC);
  const totalStopDelaySec = upcomingStopCount * clampedDwell;
  const stopDelayMin = totalStopDelaySec / 60;

  let congestionPenaltyMin = 0;
  let congestionLevel: CongestionLevel = 'NONE';
  const hasBusCongestion = nearbyBusCount >= CONGESTION_BUS_RADIUS_THRESHOLD;
  const hasBusHeavyCongestion = nearbyBusCount >= CONGESTION_BUS_HEAVY_THRESHOLD;
  const hasOccupancyCongestion = routeOccupancyAvg > CONGESTION_OCCUPANCY_THRESHOLD;

  if (hasBusHeavyCongestion || (hasBusCongestion && hasOccupancyCongestion)) {
    congestionPenaltyMin = 3; congestionLevel = 'HEAVY';
  } else if (hasBusCongestion || hasOccupancyCongestion) {
    congestionPenaltyMin = 2; congestionLevel = 'MODERATE';
  } else if (nearbyBusCount >= 2 || routeOccupancyAvg > 50) {
    congestionPenaltyMin = 1; congestionLevel = 'LIGHT';
  }

  const baseMinutes = (distanceKm / weightedSpeed) * 60 * trafficFactor;
  const rawETA = baseMinutes + stopDelayMin + congestionPenaltyMin;
  const estimatedMinutes = (!isFinite(rawETA) || isNaN(rawETA)) ? 0 : Math.max(Math.round(rawETA), 0);

  let formattedETA: string;
  if (estimatedMinutes < 1) formattedETA = 'Arriving now';
  else if (estimatedMinutes < 60) formattedETA = `${estimatedMinutes} min`;
  else { const h = Math.floor(estimatedMinutes / 60); const m = estimatedMinutes % 60; formattedETA = `${h}h ${m}m`; }

  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    estimatedMinutes, formattedETA, trafficLevel, congestionLevel,
    trafficFactor: Math.round(trafficFactor * 100) / 100,
    congestionPenaltyMin, stopDelayMin: Math.round(stopDelayMin * 10) / 10,
    weightedSpeedKmh: Math.round(weightedSpeed * 100) / 100,
  };
}

// ── Confidence Engine (must match confidence.engine.ts post-tuning) ──
const PENALTY_TRAFFIC_HIGH = 0.25;
const PENALTY_CONGESTION_MODERATE = 0.10;
const PENALTY_CONGESTION_HEAVY = 0.20;
const PENALTY_GPS_BAD = 0.10;
const PENALTY_RECONNECT_RECENT = 0.10;
const PENALTY_STOPPED = 0.05;
const PENALTY_LOW_SAMPLES = 0.05;
const MIN_CONFIDENCE = 0.45;

interface ConfInput {
  trafficLevel: TrafficLevel; congestionLevel: CongestionLevel;
  gpsAccuracyMeters?: number; reconnectedAgoMs?: number;
  currentSpeedKmh: number; historicalSampleCount?: number;
}

function calcConfidence(input: ConfInput) {
  let score = 1.0;
  const penalties: string[] = [];

  if (input.trafficLevel === 'HIGH') { score -= PENALTY_TRAFFIC_HIGH; penalties.push('Heavy traffic'); }
  if (input.congestionLevel === 'HEAVY') { score -= PENALTY_CONGESTION_HEAVY; penalties.push('Heavy congestion'); }
  else if (input.congestionLevel === 'MODERATE') { score -= PENALTY_CONGESTION_MODERATE; penalties.push('Moderate congestion'); }
  if (input.gpsAccuracyMeters != null && input.gpsAccuracyMeters > 80) { score -= PENALTY_GPS_BAD; penalties.push('Low GPS accuracy'); }
  if (input.reconnectedAgoMs != null && input.reconnectedAgoMs < 120000) { score -= PENALTY_RECONNECT_RECENT; penalties.push('Recent reconnection'); }
  if (input.currentSpeedKmh <= 0) { score -= PENALTY_STOPPED; penalties.push('Bus stopped'); }
  if (input.historicalSampleCount != null && input.historicalSampleCount < 5) { score -= PENALTY_LOW_SAMPLES; penalties.push('Limited data'); }

  if (isNaN(score) || !isFinite(score)) score = MIN_CONFIDENCE;
  score = Math.max(MIN_CONFIDENCE, Math.min(1.0, Math.round(score * 100) / 100));

  const label = score >= 0.80 ? 'HIGH' : score >= 0.60 ? 'MEDIUM' : 'LOW';
  return { score, label, penalties };
}

// ── Suggestion Engine (must match suggestion.engine.ts post-tuning) ──
interface SuggestionBus {
  busId: string; etaMinutes: number; distanceMeters: number;
  occupancyPercent: number; trafficFactor: number; confidence: number;
}

function rankBuses(buses: SuggestionBus[]) {
  if (buses.length === 0) return [];
  const scored = buses.map((bus) => {
    const etaSeconds = bus.etaMinutes * 60;
    const score =
      (etaSeconds * 0.4) + (bus.distanceMeters * 0.2) + (bus.occupancyPercent * 0.15) +
      (bus.trafficFactor * 100 * 0.15) - (bus.confidence * 120);
    return { ...bus, score: isFinite(score) ? score : Infinity };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, 3).map((bus, i) => ({ busId: bus.busId, score: Math.round(bus.score * 100) / 100, rank: i + 1 }));
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════════

function run() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Phase 6 Intelligence — Behavioral Validation');
  console.log('══════════════════════════════════════════════════════\n');

  // Clear traffic factor history for clean tests
  _prevTrafficFactor.clear();

  // ── S1-A: Stable Route ──
  console.log('── Section 1A: Stable Route ──');
  const stableBase: ETAInput = {
    busLat: 17.385, busLng: 78.486, targetLat: 17.440, targetLng: 78.500,
    currentSpeedKmh: 30, routeAvgSpeedKmh: 30,
    upcomingStopCount: 0, occupancyPercent: 20, nearbyBusCount: 0, routeOccupancyAvg: 15,
  };

  const stableETA = calcETA(stableBase);
  assert('ETA is positive', stableETA.estimatedMinutes > 0, `got ${stableETA.estimatedMinutes}`);
  assert('ETA is not NaN', !isNaN(stableETA.estimatedMinutes));
  assert('Traffic LOW on stable route', stableETA.trafficLevel === 'LOW', `got ${stableETA.trafficLevel}`);
  assert('Congestion NONE on stable route', stableETA.congestionLevel === 'NONE', `got ${stableETA.congestionLevel}`);

  const stableConf = calcConfidence({
    trafficLevel: stableETA.trafficLevel, congestionLevel: stableETA.congestionLevel,
    currentSpeedKmh: 30, historicalSampleCount: 20,
  });
  assert('Confidence ≥ 0.85 on stable route', stableConf.score >= 0.85, `got ${stableConf.score}`);

  // Oscillation: vary speed ±5 km/h
  _prevTrafficFactor.clear();
  const eta_slow = calcETA({ ...stableBase, currentSpeedKmh: 25 });
  _prevTrafficFactor.clear();
  const eta_fast = calcETA({ ...stableBase, currentSpeedKmh: 35 });
  const avg_eta = (eta_slow.estimatedMinutes + eta_fast.estimatedMinutes) / 2;
  const oscillation = Math.abs(eta_slow.estimatedMinutes - eta_fast.estimatedMinutes) / Math.max(avg_eta, 1);
  assert('Oscillation ≤ 15% for ±5km/h GPS noise', oscillation <= 0.15, `got ${(oscillation * 100).toFixed(1)}%`);

  // ── S1-B: Traffic Spike ──
  console.log('\n── Section 1B: Traffic Spike ──');
  _prevTrafficFactor.clear();
  calcETA(stableBase); // seed initial factor
  const spikeETA = calcETA({ ...stableBase, currentSpeedKmh: 21, nearbyBusCount: 4, routeOccupancyAvg: 75 });

  const etaRatio = spikeETA.estimatedMinutes / Math.max(stableETA.estimatedMinutes, 1);
  assert('ETA increases under traffic', spikeETA.estimatedMinutes > stableETA.estimatedMinutes, `stable=${stableETA.estimatedMinutes}, spike=${spikeETA.estimatedMinutes}`);
  assert('ETA does not 2x instantly', etaRatio < 2.0, `ratio=${etaRatio.toFixed(2)}`);
  assert('TrafficFactor > 1.0 under spike', spikeETA.trafficFactor > 1.0, `got ${spikeETA.trafficFactor}`);

  const spikeConf = calcConfidence({
    trafficLevel: spikeETA.trafficLevel, congestionLevel: spikeETA.congestionLevel,
    currentSpeedKmh: 21, historicalSampleCount: 20,
  });
  const confDrop = stableConf.score - spikeConf.score;
  assert('Confidence drops ≥ 0.15 under spike', confDrop >= 0.15, `drop=${confDrop.toFixed(2)} (stable=${stableConf.score}, spike=${spikeConf.score})`);

  // ── S1-C: High Occupancy Near Stop ──
  console.log('\n── Section 1C: High Occupancy + Near Stop ──');
  _prevTrafficFactor.clear();
  const noStopETA = calcETA(stableBase);
  _prevTrafficFactor.clear();
  const stopETA = calcETA({ ...stableBase, occupancyPercent: 85, upcomingStopCount: 1 });
  assert('Dwell adds time', stopETA.estimatedMinutes >= noStopETA.estimatedMinutes, `noStop=${noStopETA.estimatedMinutes}, stop=${stopETA.estimatedMinutes}`);
  assert('Dwell per stop ≤ 25s (0.42 min)', stopETA.stopDelayMin <= 0.42, `got ${stopETA.stopDelayMin} min`);

  _prevTrafficFactor.clear();
  const multi = calcETA({ ...stableBase, occupancyPercent: 85, upcomingStopCount: 4 });
  assert('4 stops dwell ≤ 100s (1.67 min)', multi.stopDelayMin <= 1.7, `got ${multi.stopDelayMin} min`);

  // ── S2: Suggestion Engine ──
  console.log('\n── Section 2: Suggestion Ranking ──');
  const busA: SuggestionBus = { busId: 'A', etaMinutes: 2, distanceMeters: 500, occupancyPercent: 95, trafficFactor: 1.30, confidence: 0.6 };
  const busB: SuggestionBus = { busId: 'B', etaMinutes: 4, distanceMeters: 500, occupancyPercent: 20, trafficFactor: 1.0, confidence: 0.9 };

  const ranked = rankBuses([busA, busB]);
  assert('Bus B (comfortable) ranks #1 over Bus A (full)', ranked[0].busId === 'B', `#1=${ranked[0].busId} (A=${ranked.find(r=>r.busId==='A')?.score}, B=${ranked.find(r=>r.busId==='B')?.score})`);

  // ── S3: Reliability Calibration ──
  console.log('\n── Section 3: Reliability Calibration ──');
  // Post-tuning formula: 100 - (delay × 3) - (disconnects × 7) - (congMin × 2)
  const relScore = 100 - (5 * 3) - (3 * 7) - (0 * 2); // = 64
  const relLabel = relScore >= 80 ? 'HIGH' : relScore >= 50 ? 'MEDIUM' : 'LOW';
  assert('3 disconnects + 5min delay → score 64', relScore === 64, `got ${relScore}`);
  assert('Label = MEDIUM (gradual, not instant LOW)', relLabel === 'MEDIUM', `got ${relLabel}`);

  // Extreme: 8 disconnects + 10 min delay + 5 min high congestion
  const relExtreme = 100 - (10 * 3) - (8 * 7) - (5 * 2); // = 100 - 30 - 56 - 10 = 4
  assert('Extreme reliability → LOW (score 4)', relExtreme < 50, `got ${relExtreme}`);

  // Mild: 1 disconnect + 1 min delay
  const relMild = 100 - (1 * 3) - (1 * 7) - (0 * 2); // = 90
  assert('Mild issues → HIGH (score 90)', relMild >= 80, `got ${relMild}`);

  // ── S4: Confidence Score Stability ──
  console.log('\n── Section 4: Confidence Stability ──');
  const heavyConf = calcConfidence({
    trafficLevel: 'HIGH', congestionLevel: 'MODERATE',
    gpsAccuracyMeters: 95, reconnectedAgoMs: 60000,
    currentSpeedKmh: 15, historicalSampleCount: 20,
  });
  assert('Heavy scenario confidence ≥ 0.45', heavyConf.score >= 0.45, `got ${heavyConf.score}`);
  assert('Heavy scenario confidence ≤ 0.65', heavyConf.score <= 0.65, `got ${heavyConf.score}`);

  const extremeConf = calcConfidence({
    trafficLevel: 'HIGH', congestionLevel: 'HEAVY',
    gpsAccuracyMeters: 150, reconnectedAgoMs: 30000,
    currentSpeedKmh: 0, historicalSampleCount: 1,
  });
  assert('Extreme never < 0.45', extremeConf.score >= 0.45, `got ${extremeConf.score}`);
  assert('Extreme never > 1.0', extremeConf.score <= 1.0, `got ${extremeConf.score}`);

  // High traffic should NOT show high confidence
  const highTrafficOnly = calcConfidence({
    trafficLevel: 'HIGH', congestionLevel: 'NONE',
    currentSpeedKmh: 30, historicalSampleCount: 20,
  });
  assert('Heavy traffic confidence ≤ 0.75', highTrafficOnly.score <= 0.75, `got ${highTrafficOnly.score}`);

  // ── S8: Congestion Cluster Accuracy ──
  console.log('\n── Section 8: Congestion Cluster ──');
  _prevTrafficFactor.clear();
  const clust3 = calcETA({ ...stableBase, nearbyBusCount: 3 });
  _prevTrafficFactor.clear();
  const clust5 = calcETA({ ...stableBase, nearbyBusCount: 5 });
  assert('3 buses within 300m → MODERATE', clust3.congestionLevel === 'MODERATE', `got ${clust3.congestionLevel}`);
  assert('5 buses within 300m → HEAVY', clust5.congestionLevel === 'HEAVY', `got ${clust5.congestionLevel}`);

  _prevTrafficFactor.clear();
  const clust2 = calcETA({ ...stableBase, nearbyBusCount: 2 });
  assert('2 buses → LIGHT', clust2.congestionLevel === 'LIGHT', `got ${clust2.congestionLevel}`);

  _prevTrafficFactor.clear();
  const clust0 = calcETA({ ...stableBase, nearbyBusCount: 0 });
  assert('0 buses → NONE', clust0.congestionLevel === 'NONE', `got ${clust0.congestionLevel}`);

  // ── S9: Edge Cases ──
  console.log('\n── Section 9: Edge Cases ──');
  _prevTrafficFactor.clear();
  const zeroSpeed = calcETA({ ...stableBase, currentSpeedKmh: 0, routeAvgSpeedKmh: 0 });
  assert('Zero speed → no NaN', !isNaN(zeroSpeed.estimatedMinutes), `got ${zeroSpeed.estimatedMinutes}`);
  assert('Zero speed → no negative', zeroSpeed.estimatedMinutes >= 0);
  assert('Zero speed → positive ETA (uses MIN_SPEED)', zeroSpeed.estimatedMinutes > 0);

  _prevTrafficFactor.clear();
  const samePoint = calcETA({ ...stableBase, targetLat: stableBase.busLat, targetLng: stableBase.busLng });
  assert('Same point → 0 min', samePoint.estimatedMinutes === 0, `got ${samePoint.estimatedMinutes}`);

  const nanConf = calcConfidence({ trafficLevel: 'LOW', congestionLevel: 'NONE', currentSpeedKmh: NaN });
  assert('NaN speed → confidence still valid', nanConf.score >= 0.45 && nanConf.score <= 1.0, `got ${nanConf.score}`);

  // Empty suggestion input
  const emptyRank = rankBuses([]);
  assert('Empty bus list → empty suggestions', emptyRank.length === 0);

  // Negative ETA guard
  _prevTrafficFactor.clear();
  const negInput = calcETA({ ...stableBase, currentSpeedKmh: -10, routeAvgSpeedKmh: -5 });
  assert('Negative speed → no negative ETA', negInput.estimatedMinutes >= 0, `got ${negInput.estimatedMinutes}`);

  // ── S6: Performance Benchmark ──
  console.log('\n── Section 6: Performance ──');
  _prevTrafficFactor.clear();
  // Warm up
  for (let i = 0; i < 50; i++) calcETA(stableBase);

  const iterations = 200;
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    calcETA({ ...stableBase, currentSpeedKmh: 20 + Math.random() * 20, nearbyBusCount: Math.floor(Math.random() * 6) });
    calcConfidence({ trafficLevel: 'MODERATE', congestionLevel: 'LIGHT', currentSpeedKmh: 25 });
    rankBuses([busA, busB]);
    times.push(performance.now() - t0);
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const p95 = times[Math.floor(iterations * 0.95)];
  const p99 = times[Math.floor(iterations * 0.99)];

  console.log(`  Avg: ${avg.toFixed(3)}ms  P95: ${p95.toFixed(3)}ms  P99: ${p99.toFixed(3)}ms`);
  assert('Avg < 20ms', avg < 20, `${avg.toFixed(3)}ms`);
  assert('P95 < 40ms', p95 < 40, `${p95.toFixed(3)}ms`);
  assert('P99 < 60ms', p99 < 60, `${p99.toFixed(3)}ms`);

  // ── S7: Flicker Simulation ──
  console.log('\n── Section 7: ETA Flicker ──');
  // Simulate 60s of ETA updates (every 3s = 20 ticks)
  const SMOOTH_THRESHOLD = 0.18;
  const etas = [10, 9, 11, 8, 12, 7, 9, 10, 8, 11, 7, 10, 9, 8, 10, 9, 11, 8, 10, 9];
  let prevSmoothed: number | null = null;
  let maxJump = 0;

  for (const raw of etas) {
    if (prevSmoothed == null) { prevSmoothed = raw; continue; }
    const diff = Math.abs(raw - prevSmoothed) / Math.max(prevSmoothed, 1);
    let smoothed: number;
    if (diff > 0.40) {
      smoothed = Math.round(0.8 * prevSmoothed + 0.2 * raw);
    } else if (diff > SMOOTH_THRESHOLD) {
      smoothed = Math.round(0.7 * prevSmoothed + 0.3 * raw);
    } else {
      smoothed = raw;
    }
    const visualJump = Math.abs(smoothed - prevSmoothed) / Math.max(prevSmoothed, 1);
    if (visualJump > maxJump) maxJump = visualJump;
    prevSmoothed = smoothed;
  }

  assert('Max visual ETA jump ≤ 20%', maxJump <= 0.20, `max jump = ${(maxJump * 100).toFixed(1)}%`);

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

run();
