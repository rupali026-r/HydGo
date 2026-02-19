-- Insert 1000 test buses with random Hyderabad-area coordinates
INSERT INTO buses (id, "registrationNo", capacity, latitude, longitude, status, "isSimulated", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'BENCH-' || i,
  52,
  17.3 + random() * 0.2,
  78.3 + random() * 0.3,
  'ACTIVE',
  false,
  NOW(),
  NOW()
FROM generate_series(1, 1000) AS i;

-- Verify count
SELECT COUNT(*) AS total_buses FROM buses;

-- EXPLAIN ANALYZE: spatial query WITHOUT GIST index (expect Seq Scan)
EXPLAIN ANALYZE
SELECT id, "registrationNo", latitude, longitude, status
FROM buses
WHERE ST_DWithin(
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
  ST_SetSRID(ST_MakePoint(78.4867, 17.3850), 4326)::geography,
  5000
);
