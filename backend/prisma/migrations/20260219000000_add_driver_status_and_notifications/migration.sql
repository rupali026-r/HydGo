-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('PENDING', 'OFFLINE', 'ONLINE', 'ON_TRIP', 'IDLE', 'DISCONNECTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DRIVER_APPLY', 'DRIVER_DISCONNECT', 'HIGH_DELAY', 'COMPLAINT', 'SYSTEM_ALERT', 'DRIVER_APPROVED', 'DRIVER_REJECTED');

-- AlterTable: Add driverStatus and lastLocationAt to drivers
ALTER TABLE "drivers" ADD COLUMN "driverStatus" "DriverStatus" NOT NULL DEFAULT 'OFFLINE';
ALTER TABLE "drivers" ADD COLUMN "lastLocationAt" TIMESTAMP(3);

-- AlterTable: Add pushToken to users
ALTER TABLE "users" ADD COLUMN "pushToken" TEXT;

-- CreateTable: driver_state_logs
CREATE TABLE "driver_state_logs" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "fromState" "DriverStatus" NOT NULL,
    "toState" "DriverStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_state_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: admin_notifications
CREATE TABLE "admin_notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drivers_driverStatus_idx" ON "drivers"("driverStatus");

-- CreateIndex
CREATE INDEX "driver_state_logs_driverId_idx" ON "driver_state_logs"("driverId");

-- CreateIndex
CREATE INDEX "driver_state_logs_createdAt_idx" ON "driver_state_logs"("createdAt");

-- CreateIndex
CREATE INDEX "admin_notifications_read_idx" ON "admin_notifications"("read");

-- CreateIndex
CREATE INDEX "admin_notifications_createdAt_idx" ON "admin_notifications"("createdAt");

-- AddForeignKey
ALTER TABLE "driver_state_logs" ADD CONSTRAINT "driver_state_logs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
