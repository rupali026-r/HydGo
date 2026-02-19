export type OccupancyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'FULL';

export interface OccupancyResult {
  level: OccupancyLevel;
  percent: number;
  available: number;
}

export function calculateOccupancy(passengerCount: number, capacity: number): OccupancyResult {
  const safeCapacity = Math.max(capacity, 1);
  const percent = Math.round((passengerCount / safeCapacity) * 100);
  const available = Math.max(safeCapacity - passengerCount, 0);

  let level: OccupancyLevel;
  if (percent >= 95) level = 'FULL';
  else if (percent > 75) level = 'HIGH';
  else if (percent >= 40) level = 'MEDIUM';
  else level = 'LOW';

  return { level, percent, available };
}
