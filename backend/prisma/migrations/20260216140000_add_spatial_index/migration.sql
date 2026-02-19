-- CreateIndex: GIST spatial index on buses for efficient proximity queries
CREATE INDEX IF NOT EXISTS idx_buses_location_gist
ON buses
USING GIST (
  (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
);
