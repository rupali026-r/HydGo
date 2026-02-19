/**
 * HydGo Driver — TypeScript type contracts
 * Matches the Express backend Prisma schema exactly.
 */

/* ── Enums ──────────────────────────────────────────────────────────────────── */

export type Role = 'PASSENGER' | 'DRIVER' | 'ADMIN';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';

export type DriverStatus = 
  | 'PENDING_APPROVAL'  // Driver registered, awaiting admin approval
  | 'NO_BUS_ASSIGNED'   // Approved but no bus assigned yet
  | 'OFFLINE'           // Approved + bus assigned, not working
  | 'ONLINE'            // Active and tracking
  | 'ON_TRIP'           // Currently on a trip
  | 'IDLE'              // Online but idle
  | 'DISCONNECTED';     // Network issue

export type BusStatus = 'ACTIVE' | 'OFFLINE' | 'MAINTENANCE';

export type TripStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type OccupancyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'FULL';

export type RouteType =
  | 'LOCAL'
  | 'METRO_EXPRESS'
  | 'SUPER_LUXURY'
  | 'PALLE_VELUGU'
  | 'EXPRESS'
  | 'GARUDA_PLUS';

/* ── Auth ───────────────────────────────────────────────────────────────────── */

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: 'DRIVER';
  phone?: string;
  licenseNumber?: string;
}

/* ── Driver ─────────────────────────────────────────────────────────────────── */

export interface DriverProfile {
  id: string;
  userId: string;
  licenseNumber: string;
  approved: boolean;
  busId: string | null;
  driverStatus: DriverStatus;
  lastLocationAt: string | null;
  user: User;
  bus: BusInfo | null;
}

export interface BusInfo {
  id: string;
  registrationNo: string;
  routeId: string | null;
  capacity: number;
  passengerCount: number;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  status: BusStatus;
  isSimulated: boolean;
  route?: RouteInfo;
}

export interface RouteInfo {
  id: string;
  routeNumber: string;
  name: string;
  routeType: RouteType;
  distance: number;
  stops?: StopInfo[];
}

export interface StopInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  stopOrder: number;
}

/* ── Trip ───────────────────────────────────────────────────────────────────── */

export interface TripInfo {
  id: string;
  busId: string;
  startTime: string;
  endTime: string | null;
  status: TripStatus;
  bus?: BusInfo;
}

/* ── Socket payloads ────────────────────────────────────────────────────────── */

export interface DriverInitPayload {
  driverId: string;
  busId: string;
  registrationNo: string;
  routeId?: string | null;
  routeNumber?: string | null;
  routeName?: string | null;
  capacity: number;
  status: DriverStatus;
}

export interface LocationUpdatePayload {
  busId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  passengerCount?: number;
}

export interface OccupancyInfo {
  level: OccupancyLevel;
  percent: number;
  available: number;
}

export interface LocationConfirmed {
  busId: string;
  occupancy: OccupancyInfo;
  timestamp: string;
}

export interface LocationRejected {
  reason: string;
}

export interface TripStarted {
  tripId: string;
  startTime: string;
}

export interface TripEnded {
  tripId: string;
  endTime: string;
}

export interface SocketError {
  message: string;
}

/* ── GPS ────────────────────────────────────────────────────────────────────── */

export interface ValidatedLocation {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
}

export interface ValidationResult {
  valid: true;
  location: ValidatedLocation;
}

export interface ValidationFailure {
  valid: false;
  reason: string;
}

export type LocationValidation = ValidationResult | ValidationFailure;
