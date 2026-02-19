// ── Phase 7.5 — Large Graph Generator ──────────────────────────────────────
// Generates 1000 routes with ~8000 total nodes for scale testing.
// Nodes are clustered around real Hyderabad coordinates.
//
// Usage: npx ts-node -r tsconfig-paths/register scripts/generate-large-graph.ts
//   or:  npx tsx scripts/generate-large-graph.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Hyderabad bounding box ──────────────────────────────────────────────────
const HYD_CENTER = { lat: 17.385, lng: 78.4867 };
const LAT_RANGE = 0.20;  // ~22 km north-south
const LNG_RANGE = 0.25;  // ~27 km east-west

// ── Config ──────────────────────────────────────────────────────────────────
const TARGET_ROUTES = 1000;
const STOPS_PER_ROUTE_MIN = 5;
const STOPS_PER_ROUTE_MAX = 15;
const TARGET_NODES = 8000;

// ── Cluster centers (major Hyderabad transit hubs) ──────────────────────────
const HUBS = [
  { name: 'Secunderabad', lat: 17.4399, lng: 78.4983 },
  { name: 'Ameerpet',     lat: 17.4375, lng: 78.4483 },
  { name: 'MGBS',         lat: 17.3784, lng: 78.4868 },
  { name: 'Dilsukhnagar', lat: 17.3688, lng: 78.5248 },
  { name: 'Kukatpally',   lat: 17.4947, lng: 78.3996 },
  { name: 'KPHB',         lat: 17.4842, lng: 78.3870 },
  { name: 'Miyapur',      lat: 17.4969, lng: 78.3516 },
  { name: 'Hitech City',  lat: 17.4435, lng: 78.3772 },
  { name: 'Gachibowli',   lat: 17.4401, lng: 78.3489 },
  { name: 'LB Nagar',     lat: 17.3480, lng: 78.5519 },
  { name: 'Uppal',        lat: 17.3998, lng: 78.5593 },
  { name: 'Mehdipatnam',  lat: 17.3950, lng: 78.4412 },
  { name: 'Charminar',    lat: 17.3616, lng: 78.4747 },
  { name: 'Begumpet',     lat: 17.4440, lng: 78.4720 },
  { name: 'Jubilee Hills',lat: 17.4326, lng: 78.4071 },
  { name: 'Shamshabad',   lat: 17.2403, lng: 78.4294 },
  { name: 'Chaderghat',   lat: 17.3706, lng: 78.4933 },
  { name: 'Lakdi ka Pul', lat: 17.4043, lng: 78.4654 },
  { name: 'Kondapur',     lat: 17.4600, lng: 78.3553 },
  { name: 'Manikonda',    lat: 17.4052, lng: 78.3867 },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function jitter(base: number, range: number): number {
  return base + (Math.random() - 0.5) * 2 * range;
}

function generateStopName(index: number): string {
  const prefixes = [
    'Bus Stop', 'Station', 'Colony', 'Nagar', 'Basti', 'Cross Roads',
    'Circle', 'Junction', 'Bridge', 'Market', 'Depot', 'Terminal',
    'Point', 'Chowk', 'Gate', 'Complex', 'Center', 'Park',
  ];
  const suffixes = [
    'A', 'B', 'C', 'D', 'E', 'North', 'South', 'East', 'West',
    'Main', 'Sub', 'Old', 'New', 'Extension',
  ];

  const prefix = prefixes[index % prefixes.length];
  const suffix = suffixes[Math.floor(index / prefixes.length) % suffixes.length];
  return `${prefix} ${suffix} ${Math.floor(index / 100) + 1}`;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function generateLargeGraph(): Promise<void> {
  const startMs = Date.now();

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Phase 7.5 — Large Graph Generator                  ║');
  console.log(`║  Target: ${TARGET_ROUTES} routes, ~${TARGET_NODES} nodes               ║`);
  console.log('╚══════════════════════════════════════════════════════╝');

  // ── 1. Generate unique node positions ──────────────────────────────────
  console.log('\n[1/4] Generating node positions...');
  const nodePositions: Array<{ name: string; lat: number; lng: number }> = [];

  // Include real hub positions first
  for (const hub of HUBS) {
    nodePositions.push({ name: hub.name, lat: hub.lat, lng: hub.lng });
  }

  // Generate remaining nodes clustered around hubs
  while (nodePositions.length < TARGET_NODES) {
    const hub = HUBS[Math.floor(Math.random() * HUBS.length)];
    const lat = jitter(hub.lat, 0.03); // ~3.3km cluster radius
    const lng = jitter(hub.lng, 0.04); // ~4.3km cluster radius

    // Clip to Hyderabad bounds
    const clippedLat = Math.max(HYD_CENTER.lat - LAT_RANGE, Math.min(HYD_CENTER.lat + LAT_RANGE, lat));
    const clippedLng = Math.max(HYD_CENTER.lng - LNG_RANGE, Math.min(HYD_CENTER.lng + LNG_RANGE, lng));

    nodePositions.push({
      name: generateStopName(nodePositions.length),
      lat: Math.round(clippedLat * 100000) / 100000,
      lng: Math.round(clippedLng * 100000) / 100000,
    });
  }

  console.log(`  Generated ${nodePositions.length} node positions`);

  // ── 2. Clear existing graph data ───────────────────────────────────────
  console.log('\n[2/4] Clearing existing graph data...');
  await prisma.graphEdge.deleteMany();
  await prisma.stopNode.deleteMany();
  console.log('  Cleared ✓');

  // ── 3. Insert nodes in batches ─────────────────────────────────────────
  console.log('\n[3/4] Inserting nodes...');
  const BATCH_SIZE = 500;
  const nodeIds: string[] = [];

  for (let i = 0; i < nodePositions.length; i += BATCH_SIZE) {
    const batch = nodePositions.slice(i, i + BATCH_SIZE);
    const results = await prisma.$transaction(
      batch.map((pos, idx) =>
        prisma.stopNode.create({
          data: {
            stopId: `gen-stop-${i + idx}`,
            name: pos.name,
            lat: pos.lat,
            lng: pos.lng,
          },
        }),
      ),
    );
    nodeIds.push(...results.map((r) => r.id));
    process.stdout.write(`  Inserted ${Math.min(i + BATCH_SIZE, nodePositions.length)}/${nodePositions.length}\r`);
  }
  console.log(`\n  ${nodeIds.length} nodes inserted ✓`);

  // ── 4. Generate routes and edges ───────────────────────────────────────
  console.log('\n[4/4] Generating routes and edges...');
  let totalEdges = 0;

  for (let r = 0; r < TARGET_ROUTES; r++) {
    const numStops = Math.floor(randomInRange(STOPS_PER_ROUTE_MIN, STOPS_PER_ROUTE_MAX + 1));

    // Pick a random origin node and build a plausible route by picking nearby nodes
    const startIdx = Math.floor(Math.random() * nodeIds.length);
    const routeNodeIds: string[] = [nodeIds[startIdx]];
    const used = new Set<number>([startIdx]);

    for (let s = 1; s < numStops; s++) {
      // Pick a random node not yet in this route (from the full set)
      let attempts = 0;
      let nextIdx: number;
      do {
        nextIdx = Math.floor(Math.random() * nodeIds.length);
        attempts++;
      } while (used.has(nextIdx) && attempts < 50);

      if (used.has(nextIdx)) break; // couldn't find new node
      used.add(nextIdx);
      routeNodeIds.push(nodeIds[nextIdx]);
    }

    if (routeNodeIds.length < 2) continue;

    // Create route ID and number
    const routeId = `gen-route-${r}`;
    const routeNumber = `R${r + 1}`;

    // Build bidirectional edges
    const edgeCreates = [];
    for (let s = 0; s < routeNodeIds.length - 1; s++) {
      const fromId = routeNodeIds[s];
      const toId = routeNodeIds[s + 1];
      const distance = randomInRange(0.5, 8.0); // 0.5–8km per segment
      const avgTravelTime = distance / randomInRange(10, 30) * 60; // 10–30 km/h → minutes

      // Forward edge
      edgeCreates.push({
        fromNodeId: fromId,
        toNodeId: toId,
        routeId,
        routeNumber,
        distance: Math.round(distance * 100) / 100,
        avgTravelTime: Math.round(avgTravelTime * 100) / 100,
        transferCost: 5,
        stopOrder: s,
      });

      // Reverse edge
      edgeCreates.push({
        fromNodeId: toId,
        toNodeId: fromId,
        routeId,
        routeNumber,
        distance: Math.round(distance * 100) / 100,
        avgTravelTime: Math.round(avgTravelTime * 100) / 100,
        transferCost: 5,
        stopOrder: routeNodeIds.length - 1 - s,
      });
    }

    await prisma.graphEdge.createMany({ data: edgeCreates });
    totalEdges += edgeCreates.length;

    if ((r + 1) % 100 === 0 || r === TARGET_ROUTES - 1) {
      process.stdout.write(`  Routes: ${r + 1}/${TARGET_ROUTES}, Edges: ${totalEdges}\r`);
    }
  }

  const elapsed = Date.now() - startMs;
  console.log(`\n\n${'═'.repeat(56)}`);
  console.log(`  Graph generation complete!`);
  console.log(`  Nodes:  ${nodeIds.length}`);
  console.log(`  Edges:  ${totalEdges}`);
  console.log(`  Routes: ${TARGET_ROUTES}`);
  console.log(`  Time:   ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`${'═'.repeat(56)}`);
}

// ── Run ─────────────────────────────────────────────────────────────────────

generateLargeGraph()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Generation failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
