-- Create GIST index on computed geography expression
CREATE INDEX idx_buses_location_gist
ON buses
USING GIST (
  (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
);

-- Force planner to use the new index
ANALYZE buses;

-- EXPLAIN ANALYZE: spatial query WITH GIST index (expect Index Scan)
EXPLAIN ANALYZE
SELECT id, "registrationNo", latitude, longitude, status
FROM buses
WHERE ST_DWithin(
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
  ST_SetSRID(ST_MakePoint(78.4867, 17.3850), 4326)::geography,
  5000
);
