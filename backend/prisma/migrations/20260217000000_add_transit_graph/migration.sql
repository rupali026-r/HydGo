-- CreateTable
CREATE TABLE "stop_nodes" (
    "id" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stop_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_edges" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "routeNumber" TEXT NOT NULL DEFAULT '',
    "distance" DOUBLE PRECISION NOT NULL,
    "avgTravelTime" DOUBLE PRECISION NOT NULL,
    "transferCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stopOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stop_nodes_stopId_key" ON "stop_nodes"("stopId");

-- CreateIndex
CREATE INDEX "stop_nodes_lat_lng_idx" ON "stop_nodes"("lat", "lng");

-- CreateIndex
CREATE INDEX "graph_edges_fromNodeId_idx" ON "graph_edges"("fromNodeId");

-- CreateIndex
CREATE INDEX "graph_edges_toNodeId_idx" ON "graph_edges"("toNodeId");

-- CreateIndex
CREATE INDEX "graph_edges_routeId_idx" ON "graph_edges"("routeId");

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "stop_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "stop_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
