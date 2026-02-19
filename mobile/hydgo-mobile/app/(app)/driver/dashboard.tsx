import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../lib/auth-context';
import {
  HeaderBar,
  NotificationBell,
  StatCard,
  Sidebar,
} from '../../../components/dashboard';

// ── Types ─────────────────────────────────────────────────────────────────────
type DriverTab = 'dashboard' | 'routes' | 'earnings' | 'documents' | 'bus' | 'ratings' | 'support';

const SIDEBAR_ITEMS = [
  { key: 'dashboard', icon: 'grid-outline' as const, label: 'Dashboard' },
  { key: 'routes', icon: 'bus-outline' as const, label: 'Route History' },
  { key: 'earnings', icon: 'cash-outline' as const, label: 'Earnings' },
  { key: 'documents', icon: 'document-text-outline' as const, label: 'Documents' },
  { key: 'bus', icon: 'construct-outline' as const, label: 'Bus Info' },
  { key: 'ratings', icon: 'star-outline' as const, label: 'Ratings' },
  { key: 'support', icon: 'help-circle-outline' as const, label: 'Support' },
];

type RouteAssignment = {
  id: string;
  routeName: string;
  fromStation: string;
  toStation: string;
  distance: string;
  busCode: string;
  timer: number;
};

const MOCK_ASSIGNMENTS: RouteAssignment[] = [
  { id: '1', routeName: 'Route 10K', fromStation: 'MGBS', toStation: 'Miyapur', distance: '28 km', busCode: 'TS 09 F 4521', timer: 20 },
  { id: '2', routeName: 'Route 216', fromStation: 'Secunderabad', toStation: 'Mehdipatnam', distance: '18 km', busCode: 'TS 09 F 8832', timer: 15 },
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [activeTab, setActiveTab] = useState<DriverTab>('dashboard');
  const [isOnline, setIsOnline] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [requests, setRequests] = useState<RouteAssignment[]>([]);
  const [acceptedRoute, setAcceptedRoute] = useState<RouteAssignment | null>(null);
  const [tripStarted, setTripStarted] = useState(false);

  // Simulate incoming route assignments when online
  useEffect(() => {
    if (isOnline && !acceptedRoute) {
      const timer = setTimeout(() => setRequests(MOCK_ASSIGNMENTS), 1500);
      return () => clearTimeout(timer);
    } else if (!isOnline) {
      setRequests([]);
    }
  }, [isOnline, acceptedRoute]);

  const acceptRoute = (route: RouteAssignment) => {
    setAcceptedRoute(route);
    setRequests([]);
  };

  const declineRoute = (id: string) => {
    setRequests((r) => r.filter((x) => x.id !== id));
  };

  const completeTrip = () => {
    setAcceptedRoute(null);
    setTripStarted(false);
  };

  // ── Sidebar / Mobile Menu ──────────────────────────────────────────────────
  const renderSidebar = () => (
    <Sidebar
      items={SIDEBAR_ITEMS}
      activeKey={activeTab}
      onSelect={(k) => {
        setActiveTab(k as DriverTab);
        if (!isWide) setShowMenu(false);
      }}
      header={
        <View style={{ paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>HydGo Driver</Text>
          <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{user?.name || user?.email}</Text>
        </View>
      }
      footer={
        <View style={{ borderTopWidth: 1, borderTopColor: '#1A1A1A', padding: 16 }}>
          <Pressable
            onPress={logout}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
          >
            <Ionicons name="log-out-outline" size={18} color="#ff4444" />
            <Text style={{ color: '#ff4444', fontSize: 13, fontWeight: '600' }}>Logout</Text>
          </Pressable>
        </View>
      }
    />
  );

  // ── Content Renderer ──────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderMainDashboard();
      case 'routes': return renderRouteHistory();
      case 'earnings': return renderEarnings();
      case 'documents': return renderDocuments();
      case 'bus': return renderBusInfo();
      case 'ratings': return renderRatings();
      case 'support': return renderDriverSupport();
      default: return renderMainDashboard();
    }
  };

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  const renderMainDashboard = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* Earnings Summary */}
      <Animated.View entering={FadeInDown.duration(300).delay(100)}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 14 }}>
          Earnings Overview
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatCard label="Today" value={1650} prefix="₹" />
          <StatCard label="This Week" value={8420} prefix="₹" />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatCard label="Total Earnings" value={42500} prefix="₹" />
          <StatCard label="Total Trips" value={187} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          <StatCard label="Avg Rating" value={4.8} />
          <StatCard label="Acceptance" value={94} suffix="%" />
        </View>
      </Animated.View>

      {/* Incoming Assignments */}
      {isOnline && !acceptedRoute && requests.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 14 }}>
            Route Assignments
          </Text>
          {requests.map((req) => (
            <RouteAssignmentCard
              key={req.id}
              request={req}
              onAccept={() => acceptRoute(req)}
              onDecline={() => declineRoute(req.id)}
            />
          ))}
        </Animated.View>
      )}

      {/* Active Route */}
      {acceptedRoute && (
        <Animated.View entering={FadeIn.duration(200)}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 14 }}>
            Active Route
          </Text>
          <View
            style={{
              borderWidth: 1,
              borderColor: '#1A1A1A',
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              backgroundColor: '#0a0a0a',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
              <View>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  {acceptedRoute.routeName}
                </Text>
                <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                  {acceptedRoute.fromStation} → {acceptedRoute.toStation} • {acceptedRoute.distance}
                </Text>
              </View>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                {acceptedRoute.busCode}
              </Text>
            </View>

            {/* Navigation Preview */}
            <View
              style={{
                height: 100,
                borderWidth: 1,
                borderColor: '#1A1A1A',
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
                backgroundColor: '#050505',
              }}
            >
              <Ionicons name="navigate-outline" size={24} color="#333" />
              <Text style={{ color: '#444', fontSize: 11, marginTop: 4 }}>Route Navigation</Text>
            </View>

            {/* Trip Timer */}
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ color: '#666', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>
                {tripStarted ? 'Trip Duration' : 'Departure In'}
              </Text>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>
                {tripStarted ? '06:42' : '5 min'}
              </Text>
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <Pressable
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderWidth: 1,
                  borderColor: '#1A1A1A',
                  borderRadius: 8,
                  paddingVertical: 10,
                }}
              >
                <Ionicons name="call-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Depot</Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderWidth: 1,
                  borderColor: '#1A1A1A',
                  borderRadius: 8,
                  paddingVertical: 10,
                }}
              >
                <Ionicons name="alert-circle-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Report</Text>
              </Pressable>
            </View>

            {/* Start / Complete */}
            <Pressable
              onPress={() => {
                if (tripStarted) completeTrip();
                else setTripStarted(true);
              }}
              style={{
                backgroundColor: '#fff',
                borderRadius: 10,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#000', fontSize: 15, fontWeight: '700' }}>
                {tripStarted ? 'Complete Trip' : 'Start Trip'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Driver Tools */}
      {isOnline && !acceptedRoute && (
        <Animated.View entering={FadeInDown.duration(300).delay(200)}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 14 }}>
            Driver Tools
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <ToolCard icon="map-outline" label="Demand Heatmap" />
            <ToolCard icon="trending-up-outline" label="Surge Zones" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            <ToolCard icon="navigate-outline" label="Route Optimizer" />
            <ToolCard icon="flag-outline" label="Daily Goal" />
          </View>

          {/* Daily Goal Progress */}
          <View
            style={{
              borderWidth: 1,
              borderColor: '#1A1A1A',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: '#ccc', fontSize: 13, fontWeight: '600' }}>Daily Goal</Text>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>₹1,650 / ₹3,000</Text>
            </View>
            <View style={{ height: 6, backgroundColor: '#1A1A1A', borderRadius: 3 }}>
              <View style={{ width: '55%', height: 6, backgroundColor: '#fff', borderRadius: 3 }} />
            </View>
          </View>
        </Animated.View>
      )}

      {/* Offline State */}
      {!isOnline && (
        <Animated.View entering={FadeIn.duration(200)}>
          <View
            style={{
              borderWidth: 1,
              borderColor: '#1A1A1A',
              borderRadius: 16,
              padding: 40,
              alignItems: 'center',
            }}
          >
            <Ionicons name="power-outline" size={40} color="#444" />
            <Text style={{ color: '#888', fontSize: 16, fontWeight: '700', marginTop: 16 }}>
              You're Offline
            </Text>
            <Text style={{ color: '#555', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
              Go online to start receiving route assignments
            </Text>
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );

  // ── ROUTE HISTORY ─────────────────────────────────────────────────────────
  const renderRouteHistory = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 20 }}>
        Route History
      </Text>
      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        {['All', 'Today', 'This Week', 'This Month'].map((f, i) => (
          <Pressable
            key={f}
            style={{
              borderWidth: 1,
              borderColor: i === 0 ? '#fff' : '#1A1A1A',
              backgroundColor: i === 0 ? '#fff' : 'transparent',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 8,
              marginRight: 8,
            }}
          >
            <Text style={{ color: i === 0 ? '#000' : '#888', fontSize: 12, fontWeight: '600' }}>{f}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {[
        { id: 2005, route: 'Route 10K', from: 'MGBS', to: 'Miyapur', dist: '28 km', passengers: 42, rating: 5, date: 'Feb 15, 2026 · 9:42 AM' },
        { id: 2004, route: 'Route 216', from: 'Secunderabad', to: 'Mehdipatnam', dist: '18 km', passengers: 38, rating: 4, date: 'Feb 15, 2026 · 8:15 AM' },
        { id: 2003, route: 'Route 5K', from: 'JBS', to: 'ECIL', dist: '22 km', passengers: 55, rating: 5, date: 'Feb 14, 2026 · 7:30 PM' },
        { id: 2002, route: 'Route 49M', from: 'Ameerpet', to: 'Uppal', dist: '16 km', passengers: 35, rating: 5, date: 'Feb 14, 2026 · 4:55 PM' },
        { id: 2001, route: 'Route 290', from: 'LB Nagar', to: 'Charminar', dist: '8 km', passengers: 28, rating: 4, date: 'Feb 14, 2026 · 2:20 PM' },
      ].map((trip) => (
        <View
          key={trip.id}
          style={{
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 14,
            padding: 16,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{trip.route}</Text>
              <Text style={{ color: '#555', fontSize: 11, marginTop: 2 }}>{trip.date}</Text>
            </View>
            <Text style={{ color: '#4CAF50', fontSize: 14, fontWeight: '700' }}>{trip.passengers} pax</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' }} />
            <Text style={{ color: '#888', fontSize: 12 }}>{trip.from}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff4444' }} />
            <Text style={{ color: '#888', fontSize: 12 }}>{trip.to}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#555', fontSize: 11 }}>{trip.dist}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="star" size={11} color="#fff" />
              <Text style={{ color: '#ccc', fontSize: 11, fontWeight: '600' }}>{trip.rating}.0</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // ── EARNINGS ──────────────────────────────────────────────────────────────
  const renderEarnings = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 20 }}>
        Earnings
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <StatCard label="Today" value={1650} prefix="₹" />
        <StatCard label="This Week" value={8420} prefix="₹" />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
        <StatCard label="This Month" value={32800} prefix="₹" />
        <StatCard label="Total" value={42500} prefix="₹" />
      </View>

      {/* Payout Info */}
      <View
        style={{
          borderWidth: 1,
          borderColor: '#1A1A1A',
          borderRadius: 14,
          padding: 18,
          marginBottom: 24,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ color: '#888', fontSize: 12 }}>Next Payout</Text>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>₹8,420</Text>
        </View>
        <Text style={{ color: '#555', fontSize: 11, marginTop: 4 }}>Processes on Monday · HDFC ****4521</Text>
      </View>

      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
        Daily Breakdown
      </Text>
      {[
        { day: 'Mon', amt: 800 },
        { day: 'Tue', amt: 1000 },
        { day: 'Wed', amt: 1200 },
        { day: 'Thu', amt: 1400 },
        { day: 'Fri', amt: 1600 },
        { day: 'Sat', amt: 1800 },
        { day: 'Sun', amt: 620 },
      ].map((item) => (
        <View
          key={item.day}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#0d0d0d',
          }}
        >
          <Text style={{ color: '#888', fontSize: 13, width: 40 }}>{item.day}</Text>
          <View style={{ flex: 1, height: 4, backgroundColor: '#1A1A1A', borderRadius: 2, marginHorizontal: 12 }}>
            <View
              style={{
                width: `${(item.amt / 2000) * 100}%`,
                height: 4,
                backgroundColor: '#fff',
                borderRadius: 2,
              }}
            />
          </View>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', width: 60, textAlign: 'right' }}>
            ₹{item.amt.toLocaleString()}
          </Text>
        </View>
      ))}

      {/* Incentives */}
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 12 }}>
        Incentives & Bonuses
      </Text>
      {[
        { title: 'Peak Hour Bonus', desc: 'Complete 5 trips during 8-10 AM', reward: '₹200', progress: 60 },
        { title: 'Weekend Warrior', desc: 'Complete 20 trips this weekend', reward: '₹500', progress: 35 },
        { title: 'Perfect Rating', desc: 'Maintain 4.8+ rating this week', reward: '₹150', progress: 100 },
      ].map((inc) => (
        <View
          key={inc.title}
          style={{
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 12,
            padding: 16,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{inc.title}</Text>
            <Text style={{ color: '#4CAF50', fontSize: 13, fontWeight: '700' }}>{inc.reward}</Text>
          </View>
          <Text style={{ color: '#555', fontSize: 11, marginBottom: 10 }}>{inc.desc}</Text>
          <View style={{ height: 4, backgroundColor: '#1A1A1A', borderRadius: 2 }}>
            <View
              style={{
                width: `${inc.progress}%`,
                height: 4,
                backgroundColor: inc.progress === 100 ? '#4CAF50' : '#fff',
                borderRadius: 2,
              }}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // ── DOCUMENTS ─────────────────────────────────────────────────────────────
  const renderDocuments = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 20 }}>
        Documents
      </Text>
      {[
        { name: 'Driving License', status: 'Verified', icon: 'card-outline' as const, expiry: 'Expires Mar 2028' },
        { name: 'Vehicle Registration', status: 'Verified', icon: 'document-outline' as const, expiry: 'Expires Dec 2026' },
        { name: 'Insurance', status: 'Pending Review', icon: 'shield-outline' as const, expiry: 'Uploaded Feb 14' },
        { name: 'Profile Photo', status: 'Verified', icon: 'person-outline' as const, expiry: '' },
        { name: 'Background Check', status: 'Verified', icon: 'checkmark-circle-outline' as const, expiry: 'Verified Jan 2026' },
      ].map((doc) => (
        <View
          key={doc.name}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 14,
            padding: 16,
            marginBottom: 10,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: '#111',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={doc.icon} size={20} color="#888" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{doc.name}</Text>
            {doc.expiry ? (
              <Text style={{ color: '#555', fontSize: 11, marginTop: 2 }}>{doc.expiry}</Text>
            ) : null}
          </View>
          <View
            style={{
              backgroundColor: doc.status === 'Verified' ? '#0a1f0a' : '#1a1400',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 6,
            }}
          >
            <Text
              style={{
                color: doc.status === 'Verified' ? '#4CAF50' : '#FFC107',
                fontSize: 11,
                fontWeight: '600',
              }}
            >
              {doc.status}
            </Text>
          </View>
        </View>
      ))}

      <Pressable
        style={{
          borderWidth: 1,
          borderColor: '#333',
          borderRadius: 10,
          paddingVertical: 14,
          alignItems: 'center',
          marginTop: 12,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Upload New Document</Text>
      </Pressable>
    </ScrollView>
  );

  // ── BUS INFO ───────────────────────────────────────────────────────────────
  const renderBusInfo = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 20 }}>
        Bus Info
      </Text>
      <View style={{ borderWidth: 1, borderColor: '#1A1A1A', borderRadius: 16, padding: 20, marginBottom: 20 }}>
        {/* Bus Image Placeholder */}
        <View
          style={{
            height: 120,
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            backgroundColor: '#050505',
          }}
        >
          <Ionicons name="bus-outline" size={40} color="#333" />
        </View>

        {[
          { label: 'Bus Type', value: 'Metro Express' },
          { label: 'Bus Code', value: 'TS 09 F 4521' },
          { label: 'Depot', value: 'Miyapur Depot' },
          { label: 'Year', value: '2023' },
          { label: 'Capacity', value: '52 Seats' },
          { label: 'Fuel', value: 'Diesel BS-VI' },
          { label: 'Status', value: 'Active' },
        ].map((item, i, arr) => (
          <View
            key={item.label}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 13,
              borderBottomWidth: i < arr.length - 1 ? 1 : 0,
              borderBottomColor: '#0d0d0d',
            }}
          >
            <Text style={{ color: '#666', fontSize: 13 }}>{item.label}</Text>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* Maintenance */}
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
        Maintenance
      </Text>
      {[
        { title: 'Last Service', value: 'Jan 28, 2026', icon: 'build-outline' as const },
        { title: 'Next Service Due', value: 'Apr 28, 2026', icon: 'calendar-outline' as const },
        { title: 'Odometer', value: '24,520 km', icon: 'speedometer-outline' as const },
      ].map((item) => (
        <View
          key={item.title}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 12,
            padding: 14,
            marginBottom: 8,
          }}
        >
          <Ionicons name={item.icon} size={18} color="#666" />
          <Text style={{ color: '#888', fontSize: 13, flex: 1 }}>{item.title}</Text>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{item.value}</Text>
        </View>
      ))}
    </ScrollView>
  );

  // ── RATINGS ───────────────────────────────────────────────────────────────
  const renderRatings = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 20 }}>
        Ratings & Reviews
      </Text>

      {/* Rating Summary */}
      <View
        style={{
          borderWidth: 1,
          borderColor: '#1A1A1A',
          borderRadius: 16,
          padding: 24,
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 52, fontWeight: '800' }}>4.8</Text>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons key={s} name={s <= 4 ? 'star' : 'star-half'} size={20} color="#fff" />
          ))}
        </View>
      <Text style={{ color: '#666', fontSize: 13, marginTop: 8 }}>Based on 187 trips</Text>
      </View>

      {/* Distribution */}
      {[
        { star: 5, pct: 72, count: 135 },
        { star: 4, pct: 20, count: 37 },
        { star: 3, pct: 5, count: 10 },
        { star: 2, pct: 2, count: 3 },
        { star: 1, pct: 1, count: 2 },
      ].map((item) => (
        <View key={item.star} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Text style={{ color: '#888', fontSize: 12, width: 8 }}>{item.star}</Text>
          <Ionicons name="star" size={11} color="#555" />
          <View style={{ flex: 1, height: 4, backgroundColor: '#1A1A1A', borderRadius: 2 }}>
            <View
              style={{
                width: `${item.pct}%`,
                height: 4,
                backgroundColor: '#fff',
                borderRadius: 2,
              }}
            />
          </View>
          <Text style={{ color: '#555', fontSize: 11, width: 30, textAlign: 'right' }}>{item.count}</Text>
        </View>
      ))}

      {/* Recent Reviews */}
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 12 }}>
        Recent Reviews
      </Text>
      {[
        { name: 'Kavitha S.', rating: 5, comment: 'Very punctual and safe driver. Bus was clean.', date: 'Feb 15' },
        { name: 'Ravi K.', rating: 4, comment: 'Good trip, slightly late departure.', date: 'Feb 15' },
        { name: 'Priya D.', rating: 5, comment: 'Excellent! Smooth driving on the express route.', date: 'Feb 14' },
      ].map((review) => (
        <View
          key={review.name}
          style={{
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 12,
            padding: 14,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{review.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="star" size={11} color="#fff" />
              <Text style={{ color: '#ccc', fontSize: 11, fontWeight: '600' }}>{review.rating}</Text>
            </View>
          </View>
          <Text style={{ color: '#888', fontSize: 12 }}>{review.comment}</Text>
          <Text style={{ color: '#444', fontSize: 10, marginTop: 6 }}>{review.date}</Text>
        </View>
      ))}
    </ScrollView>
  );

  // ── SUPPORT ───────────────────────────────────────────────────────────────
  const renderDriverSupport = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 20 }}>
        Driver Support
      </Text>

      {/* Quick Actions */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {[
          { icon: 'chatbubble-outline' as const, label: 'Live Chat' },
          { icon: 'call-outline' as const, label: 'Call Us' },
        ].map((a) => (
          <Pressable
            key={a.label}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#1A1A1A',
              borderRadius: 12,
              paddingVertical: 18,
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Ionicons name={a.icon} size={22} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {[
        { icon: 'help-circle-outline' as const, title: 'Driver FAQs', desc: 'Common driving questions' },
        { icon: 'cash-outline' as const, title: 'Payment Issues', desc: 'Earnings, payouts, deductions' },
        { icon: 'warning-outline' as const, title: 'Report Incident', desc: 'Safety or accident report' },
        { icon: 'bus-outline' as const, title: 'Bus Assistance', desc: 'Bus breakdown or depot service' },
        { icon: 'shield-checkmark-outline' as const, title: 'Insurance Claims', desc: 'File or track a claim' },
        { icon: 'document-text-outline' as const, title: 'Account & Documents', desc: 'Profile, verification, docs' },
      ].map((item) => (
        <Pressable
          key={item.title}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 14,
            padding: 16,
            marginBottom: 10,
          }}
        >
          <Ionicons name={item.icon} size={20} color="#888" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{item.title}</Text>
            <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{item.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#444" />
        </Pressable>
      ))}

      {/* Emergency */}
      <Pressable
        style={{
          borderWidth: 1,
          borderColor: '#ff4444',
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          marginTop: 12,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Ionicons name="warning" size={18} color="#ff4444" />
        <Text style={{ color: '#ff4444', fontSize: 14, fontWeight: '700' }}>Emergency SOS</Text>
      </Pressable>
    </ScrollView>
  );

  // ── MAIN RENDER ───────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Header */}
      <HeaderBar
        title="HydGo Driver"
        right={
          <>
            {/* Online/Offline Toggle */}
            <Pressable
              onPress={() => setIsOnline(!isOnline)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: isOnline ? '#4CAF50' : '#333',
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 6,
                backgroundColor: isOnline ? '#0a1f0a' : 'transparent',
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: isOnline ? '#4CAF50' : '#666',
                }}
              />
              <Text
                style={{
                  color: isOnline ? '#4CAF50' : '#888',
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </Pressable>
            <NotificationBell count={isOnline ? requests.length : 0} onPress={() => {}} />
            {!isWide && (
              <Pressable onPress={() => setShowMenu(!showMenu)} hitSlop={8}>
                <Ionicons name="menu" size={22} color="#fff" />
              </Pressable>
            )}
          </>
        }
      />

      {/* Body */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Sidebar (desktop) */}
        {isWide && renderSidebar()}

        {/* Mobile slide-in menu */}
        {!isWide && showMenu && (
          <Animated.View
            entering={FadeIn.duration(150)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              zIndex: 10,
              flexDirection: 'row',
            }}
          >
            {renderSidebar()}
            <Pressable
              onPress={() => setShowMenu(false)}
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.6)',
              }}
            />
          </Animated.View>
        )}

        {/* Content */}
        <View style={{ flex: 1 }}>{renderContent()}</View>
      </View>
    </View>
  );
}

// ── Route Assignment Card ─────────────────────────────────────────────────────
function RouteAssignmentCard({
  request: assignment,
  onAccept,
  onDecline,
}: {
  request: RouteAssignment;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [timer, setTimer] = useState(assignment.timer);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          onDecline();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: '#1A1A1A',
        borderRadius: 14,
        padding: 18,
        marginBottom: 12,
        backgroundColor: '#0a0a0a',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <View>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{assignment.routeName}</Text>
          <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{assignment.fromStation} → {assignment.toStation}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{assignment.busCode}</Text>
          <Text style={{ color: '#666', fontSize: 11 }}>{assignment.distance}</Text>
        </View>
      </View>

      {/* Timer */}
      <View style={{ height: 3, backgroundColor: '#1A1A1A', borderRadius: 2, marginBottom: 14 }}>
        <View
          style={{
            width: `${(timer / assignment.timer) * 100}%`,
            height: 3,
            backgroundColor: timer <= 5 ? '#ff4444' : '#fff',
            borderRadius: 2,
          }}
        />
      </View>
      <Text style={{ color: '#888', fontSize: 11, textAlign: 'center', marginBottom: 12 }}>
        {timer}s remaining
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={onDecline}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#333',
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#888', fontSize: 14, fontWeight: '600' }}>Decline</Text>
        </Pressable>
        <Pressable
          onPress={onAccept}
          style={{
            flex: 2,
            backgroundColor: '#fff',
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#000', fontSize: 14, fontWeight: '700' }}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Tool Card ─────────────────────────────────────────────────────────────────
function ToolCard({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <Pressable
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: '#1A1A1A',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Ionicons name={icon} size={22} color="#888" />
      <Text style={{ color: '#ccc', fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
