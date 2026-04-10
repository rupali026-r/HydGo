-- CreateIndex: B-tree composite index on buses for location queries
-- (PostGIS GIST index replaced with standard B-tree for compatibility)
CREATE INDEX IF NOT EXISTS idx_buses_location_btree
ON buses (latitude, longitude);
