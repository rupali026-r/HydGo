// ── Phase 7.5 — Route Benchmark ─────────────────────────────────────────────
// Tests route planning performance with realistic traffic patterns.
// Uses a fixed coordinate pool to simulate spatial locality and cache reuse.
//
// Usage: npx tsx scripts/route-benchmark.ts
//
// Options (env vars):
//   BENCHMARK_CONCURRENCY=20  — number of concurrent requests per batch
//   BENCHMARK_BATCHES=3       — number of test batches (cache warms across batches)
//   API_BASE=http://localhost:3000 — backend URL

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const CONCURRENCY = parseInt(process.env.BENCHMARK_CONCURRENCY || '20', 10);
const BATCHES = parseInt(process.env.BENCHMARK_BATCHES || '3', 10);

// ── Hyderabad coordinate ranges ─────────────────────────────────────────────
const LAT_MIN = 17.28;
const LAT_MAX = 17.52;
const LNG_MIN = 78.35;
const LNG_MAX = 78.58;

function randomLat(): number { return LAT_MIN + Math.random() * (LAT_MAX - LAT_MIN); }
function randomLng(): number { return LNG_MIN + Math.random() * (LNG_MAX - LNG_MIN); }

// ── Pre-generate a fixed pool of coordinate pairs ───────────────────────────
// This simulates realistic traffic: popular OD pairs get repeated across batches.
const POOL_SIZE = Math.max(CONCURRENCY, 30);
const coordinatePool: Array<{ fromLat: string; fromLng: string; toLat: string; toLng: string }> = [];
for (let i = 0; i < POOL_SIZE; i++) {
  coordinatePool.push({
    fromLat: randomLat().toFixed(6),
    fromLng: randomLng().toFixed(6),
    toLat: randomLat().toFixed(6),
    toLng: randomLng().toFixed(6),
  });
}

interface RequestResult {
  durationMs: number;
  status: number;
  cached: boolean;
  routeCount: number;
  error?: string;
}

async function fireRequest(coords: typeof coordinatePool[0]): Promise<RequestResult> {
  const url = `${API_BASE}/api/transit/route-plan?fromLat=${coords.fromLat}&fromLng=${coords.fromLng}&toLat=${coords.toLat}&toLng=${coords.toLng}`;
  const start = Date.now();

  try {
    const res = await fetch(url);
    const body = await res.json();
    return {
      durationMs: Date.now() - start,
      status: res.status,
      cached: body.cached || false,
      routeCount: body.count || 0,
    };
  } catch (err: any) {
    return {
      durationMs: Date.now() - start,
      status: 0,
      cached: false,
      routeCount: 0,
      error: err.message,
    };
  }
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil(sorted.length * (p / 100)) - 1;
  return sorted[Math.max(0, idx)];
}

async function runBatch(batchNum: number): Promise<void> {
  console.log(`\n── Batch ${batchNum}/${BATCHES}: ${CONCURRENCY} concurrent requests ──`);
  const batchStart = Date.now();

  // Pick coordinates from the pool (with wraparound for reuse)
  const promises: Promise<RequestResult>[] = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    const coords = coordinatePool[i % coordinatePool.length];
    promises.push(fireRequest(coords));
  }

  const results = await Promise.all(promises);
  const batchDuration = Date.now() - batchStart;

  // Analyze results
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const errors = results.filter((r) => r.status !== 200);
  const cached = results.filter((r) => r.cached);
  const withRoutes = results.filter((r) => r.routeCount > 0);

  const avg = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
  const min = durations[0];
  const max = durations[durations.length - 1];
  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const throughput = Math.round((CONCURRENCY / batchDuration) * 1000);

  console.log('');
  console.log('┌──────────────────────────────────────────────────────┐');
  console.log(`│  Batch ${batchNum} Results                                    │`);
  console.log('├──────────────────────────────────────────────────────┤');
  console.log(`│  Requests:    ${CONCURRENCY.toString().padStart(8)}                           │`);
  console.log(`│  Successes:   ${(CONCURRENCY - errors.length).toString().padStart(8)}  (${Math.round(((CONCURRENCY - errors.length) / CONCURRENCY) * 100)}%)                    │`);
  console.log(`│  Errors:      ${errors.length.toString().padStart(8)}                           │`);
  console.log(`│  Cache Hits:  ${cached.length.toString().padStart(8)}  (${Math.round((cached.length / CONCURRENCY) * 100)}%)                    │`);
  console.log(`│  Routes Found:${withRoutes.length.toString().padStart(8)}  (${Math.round((withRoutes.length / CONCURRENCY) * 100)}%)                    │`);
  console.log('├──────────────────────────────────────────────────────┤');
  console.log(`│  Latency (ms):                                      │`);
  console.log(`│    Min:       ${min.toString().padStart(8)}                           │`);
  console.log(`│    Avg:       ${avg.toString().padStart(8)}                           │`);
  console.log(`│    P50:       ${p50.toString().padStart(8)}                           │`);
  console.log(`│    P95:       ${p95.toString().padStart(8)}                           │`);
  console.log(`│    P99:       ${p99.toString().padStart(8)}                           │`);
  console.log(`│    Max:       ${max.toString().padStart(8)}                           │`);
  console.log('├──────────────────────────────────────────────────────┤');
  console.log(`│  Throughput:  ${throughput.toString().padStart(8)} req/s                     │`);
  console.log(`│  Wall Time:   ${(batchDuration / 1000).toFixed(1).padStart(7)}s                          │`);
  console.log('└──────────────────────────────────────────────────────┘');

  // Pass/fail criteria
  console.log('\n── Acceptance Criteria ──');
  const criteriaResults = [
    { name: 'Avg < 40ms',      pass: avg < 40,      value: `${avg}ms` },
    { name: 'P95 < 75ms',      pass: p95 < 75,      value: `${p95}ms` },
    { name: 'P99 < 150ms',     pass: p99 < 150,     value: `${p99}ms` },
    { name: 'Error rate < 1%', pass: errors.length / CONCURRENCY < 0.01, value: `${(errors.length / CONCURRENCY * 100).toFixed(1)}%` },
    { name: 'No crashes',      pass: errors.filter(e => e.status === 0).length === 0, value: `${errors.filter(e => e.status === 0).length} crashes` },
  ];

  for (const c of criteriaResults) {
    console.log(`  ${c.pass ? '✅' : '❌'} ${c.name.padEnd(20)} → ${c.value}`);
  }

  const allPass = criteriaResults.every((c) => c.pass);
  console.log(`\n  ${allPass ? '🎉 ALL CRITERIA PASSED' : '⚠️  SOME CRITERIA FAILED'}`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Phase 7.5 — Route Planning Benchmark               ║');
  console.log(`║  Target: ${CONCURRENCY} concurrent requests × ${BATCHES} batch(es)     ║`);
  console.log(`║  Server: ${API_BASE.padEnd(42)}║`);
  console.log('╚══════════════════════════════════════════════════════╝');

  // Warmup: send a few requests to prime JIT and cache a few entries
  console.log('\n[Warmup] Priming JIT and cache...');
  for (let i = 0; i < Math.min(5, coordinatePool.length); i++) {
    const warmup = await fireRequest(coordinatePool[i]);
    console.log(`  Warmup ${i + 1}: ${warmup.durationMs}ms, status ${warmup.status}, cached: ${warmup.cached}`);
  }

  for (let b = 1; b <= BATCHES; b++) {
    await runBatch(b);
  }

  // Fetch memory metrics after benchmark
  try {
    const metricsRes = await fetch(`${API_BASE}/api/transit/graph-stats`);
    const metrics = await metricsRes.json();
    console.log('\n── Server Graph State ──');
    console.log(`  Nodes: ${metrics.nodes}, Edges: ${metrics.edges}, Loaded: ${metrics.loaded}`);
  } catch {
    console.log('  (Could not fetch graph stats)');
  }
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
