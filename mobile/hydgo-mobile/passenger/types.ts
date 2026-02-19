// ── Passenger Map Engine Types ──────────────────────────────────────────────
// Shared types for the real-time passenger experience

export type OccupancyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'FULL';

export type RouteType =
  | 'LOCAL'
  | 'METRO_EXPRESS'
  | 'SUPER_LUXURY'
  | 'PALLE_VELUGU'
  | 'EXPRESS'
  | 'GARUDA_PLUS';

export interface OccupancyInfo {
  level: OccupancyLevel;
  percent: number;
  available: number;
}

export interface ETAInfo {
  distanceKm: number;
  estimatedMinutes: number;
  formattedETA: string;
}

// ── Intelligence Types ──────────────────────────────────────────────────────

export type TrafficLevel = 'LOW' | 'MODERATE' | 'HIGH';
export type CongestionLevel = 'NONE' | 'LIGHT' | 'MODERATE' | 'HEAVY';
export type ConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW';
export type ReliabilityLabel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ReliabilityInfo {
  score: number;
  label: ReliabilityLabel;
}

export interface SuggestionInfo {
  busId: string;
  score: number;
  rank: number;
  reason: string;
  registrationNo?: string;
  routeNumber?: string;
  routeName?: string;
  etaMinutes: number;
  distanceMeters: number;
  occupancyPercent: number;
  confidence: number;
}

/** Core bus state received from backend */
export interface BusState {
  id: string;
  registrationNo: string;
  routeNumber?: string;
  routeName?: string;
  routeType?: RouteType;
  routeId?: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  passengerCount?: number;
  capacity?: number;
  occupancy: OccupancyInfo;
  eta?: ETAInfo;
  distanceMeters?: number;
  // Intelligence fields (Phase 6)
  trafficLevel?: TrafficLevel;
  congestionLevel?: CongestionLevel;
  trafficFactor?: number;
  confidence?: number;        // 0.40 – 1.00
  confidenceLabel?: ConfidenceLabel;
  reliability?: ReliabilityInfo;
}

/** Bus state with interpolation data for smooth animation */
export interface InterpolatedBus extends BusState {
  prevLatitude: number;
  prevLongitude: number;
  targetLatitude: number;
  targetLongitude: number;
  interpolationStart: number;
  displayLatitude: number;
  displayLongitude: number;
}

/** Stop model from backend */
export interface StopInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  routeId: string;
  stopOrder: number;
}

/** Route model from backend */
export interface RouteInfo {
  id: string;
  routeNumber: string;
  name: string;
  routeType: RouteType;
  polyline: string | number[][];
  avgSpeed: number;
  distance: number;
  stops?: StopInfo[];
}

/** Bus update from simulation broadcast */
export interface BusUpdate {
  busId: string;
  routeId?: string;
  routeNumber?: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  passengerCount: number;
  capacity: number;
  occupancy: OccupancyInfo;
}

/** Socket connection state */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/** User location */
export interface UserLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  accuracy?: number;
}

// ── Journey Types ───────────────────────────────────────────────────────────

export type JourneyStatus = 'idle' | 'waiting' | 'boarding' | 'onboard' | 'completed' | 'cancelled';

export interface ActiveJourney {
  id: string;
  busId: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  fromStop: StopInfo;
  toStop?: StopInfo;
  status: JourneyStatus;
  startedAt: number;
  etaMinutes: number;
  busDistanceMeters: number;
  nextStopName?: string;
  destinationEtaMinutes?: number;
  occupancyTrend?: 'rising' | 'falling' | 'stable';
  trafficLevel?: TrafficLevel;
}

export interface JourneyRecord {
  id: string;
  routeNumber: string;
  routeName: string;
  fromStopName: string;
  toStopName?: string;
  date: string;
  waitTimeMinutes: number;
  travelDurationMinutes: number;
  reliabilityExperienced: ReliabilityLabel;
  trafficLevel: TrafficLevel;
}

// ── Directions Types ────────────────────────────────────────────────────────

export interface DirectionsQuery {
  from: { name: string; latitude: number; longitude: number };
  to: { name: string; latitude: number; longitude: number };
}

export interface DirectionsRoute {
  id: string;
  routeNumber: string;
  routeName: string;
  totalDurationMinutes: number;
  walkingDistanceMeters: number;
  reliability: ReliabilityInfo;
  trafficLevel: TrafficLevel;
  confidence: number;
  transfers: TransferInfo[];
  polyline: string | number[][];
  stops: StopInfo[];
  firstBusEta?: number;
}

export interface TransferInfo {
  fromRoute: string;
  toRoute: string;
  atStop: string;
  walkingMeters: number;
  waitMinutes: number;
}

// ── Profile Types ───────────────────────────────────────────────────────────

export interface SavedStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface FavoriteRoute {
  id: string;
  routeNumber: string;
  name: string;
}

// ── Notification Types ──────────────────────────────────────────────────────

export type NotificationType =
  | 'bus_arriving'
  | 'bus_delayed'
  | 'journey_started'
  | 'journey_completed';

export interface PassengerNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  data?: Record<string, any>;
}
