// ── Journey Tracking Hook ───────────────────────────────────────────────────
// Manages active journey lifecycle: start, track, notify, complete.
// Monitors tracked bus and triggers proximity notifications.

import { useEffect, useRef, useCallback } from 'react';
import { usePassengerStore } from '../store/passengerStore';
import { distanceMeters } from '../utils/geo';
import type { ActiveJourney, StopInfo, BusState } from '../types';

const ARRIVAL_THRESHOLD_METERS = 200;
const JOURNEY_UPDATE_INTERVAL = 3000;

export function useJourney() {
  const activeJourney = usePassengerStore((s) => s.activeJourney);
  const buses = usePassengerStore((s) => s.buses);
  const userLocation = usePassengerStore((s) => s.userLocation);
  const updateJourney = usePassengerStore((s) => s.updateJourney);
  const completeJourney = usePassengerStore((s) => s.completeJourney);
  const startJourney = usePassengerStore((s) => s.startJourney);
  const cancelJourney = usePassengerStore((s) => s.cancelJourney);
  const addNotification = usePassengerStore((s) => s.addNotification);

  const notifiedArrivalRef = useRef(false);

  // Track active journey bus position
  useEffect(() => {
    if (!activeJourney) {
      notifiedArrivalRef.current = false;
      return;
    }

    const interval = setInterval(() => {
      const bus = buses.get(activeJourney.busId);
      if (!bus) return;

      const updates: Partial<ActiveJourney> = {};

      // Update ETA from bus
      if (bus.eta) {
        updates.etaMinutes = bus.eta.estimatedMinutes;
      }

      // Update bus distance to user's from stop
      const dist = distanceMeters(
        bus.latitude,
        bus.longitude,
        activeJourney.fromStop.latitude,
        activeJourney.fromStop.longitude,
      );
      updates.busDistanceMeters = dist;

      // Traffic level
      if (bus.trafficLevel) {
        updates.trafficLevel = bus.trafficLevel;
      }

      // Occupancy trend (simplified)
      if (bus.occupancy) {
        const pct = bus.occupancy.percent;
        updates.occupancyTrend = pct > 75 ? 'rising' : pct < 30 ? 'falling' : 'stable';
      }

      // Proximity notification
      if (dist <= ARRIVAL_THRESHOLD_METERS && !notifiedArrivalRef.current) {
        notifiedArrivalRef.current = true;
        updates.status = 'boarding';
        addNotification({
          id: `arrival-${Date.now()}`,
          type: 'bus_arriving',
          title: 'Bus Arriving',
          body: `Your bus ${activeJourney.routeNumber} is arriving at ${activeJourney.fromStop.name}.`,
          timestamp: Date.now(),
          read: false,
        });
      }

      updateJourney(updates);
    }, JOURNEY_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [activeJourney?.busId, buses]);

  const beginJourney = useCallback(
    (bus: BusState, fromStop: StopInfo, toStop?: StopInfo) => {
      const journey: ActiveJourney = {
        id: `j-${Date.now()}`,
        busId: bus.id,
        routeId: bus.routeId ?? '',
        routeNumber: bus.routeNumber ?? '',
        routeName: bus.routeName ?? '',
        fromStop,
        toStop,
        status: 'waiting',
        startedAt: Date.now(),
        etaMinutes: bus.eta?.estimatedMinutes ?? 0,
        busDistanceMeters: bus.distanceMeters ?? 0,
        trafficLevel: bus.trafficLevel,
      };

      startJourney(journey);

      addNotification({
        id: `start-${Date.now()}`,
        type: 'journey_started',
        title: 'Journey Started',
        body: `Tracking ${bus.routeNumber} to ${fromStop.name}.`,
        timestamp: Date.now(),
        read: false,
      });
    },
    [startJourney, addNotification],
  );

  const endJourney = useCallback(() => {
    if (!activeJourney) return;
    addNotification({
      id: `complete-${Date.now()}`,
      type: 'journey_completed',
      title: 'Journey Completed',
      body: `Your trip on ${activeJourney.routeNumber} has ended.`,
      timestamp: Date.now(),
      read: false,
    });
    completeJourney();
  }, [activeJourney, completeJourney, addNotification]);

  return {
    activeJourney,
    beginJourney,
    endJourney,
    cancelJourney,
  };
}
