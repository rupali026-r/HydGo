import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../lib/auth-context';
import {
  HeaderBar,
  NotificationBell,
  StatCard,
  Sidebar,
  NotificationCenter,
} from '../../../components/dashboard';
import { api } from '../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type AdminTab =
  | 'overview'
  | 'users'
  | 'drivers'
  | 'routes'
  | 'payments'
  | 'reports'
  | 'analytics'
  | 'disputes'
  | 'notifications'
  | 'settings'
  | 'admins';

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dynamic badge counts
  const [notificationCount, setNotificationCount] = useState(0);
  const [pendingDrivers, setPendingDrivers] = useState(0);
  const [openDisputes, setOpenDisputes] = useState(0);

  // Fetch dashboard summary for live badge counts
  useEffect(() => {
    const fetchDashboardSummary = async () => {
      try {
        const response = await api.get('/admin/dashboard-summary');
        if (response.data.success) {
          const data = response.data.data;
          setPendingDrivers(data.pendingDrivers || 0);
          setOpenDisputes(data.openComplaints || 0);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard summary:', error);
      }
    };

    fetchDashboardSummary();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardSummary, 30000);
    return () => clearInterval(interval);
  }, []);

  const SIDEBAR_ITEMS: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; badge?: number }[] = [
    { key: 'overview', icon: 'grid-outline', label: 'Overview' },
    { key: 'users', icon: 'people-outline', label: 'Users' },
    { key: 'drivers', icon: 'bus-outline', label: 'Drivers', badge: pendingDrivers },
    { key: 'routes', icon: 'map-outline', label: 'Route Monitor' },
    { key: 'payments', icon: 'card-outline', label: 'Payments' },
    { key: 'reports', icon: 'bar-chart-outline', label: 'Reports' },
    { key: 'analytics', icon: 'analytics-outline', label: 'Analytics' },
    { key: 'disputes', icon: 'warning-outline', label: 'Disputes', badge: openDisputes },
    { key: 'notifications', icon: 'notifications-outline', label: 'Notifications' },
    { key: 'settings', icon: 'settings-outline', label: 'Settings' },
    { key: 'admins', icon: 'shield-outline', label: 'Admin Mgmt' },
  ];

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const renderSidebar = () => (
    <Sidebar
      items={SIDEBAR_ITEMS}
      activeKey={activeTab}
      onSelect={(k) => {
        setActiveTab(k as AdminTab);
        if (!isWide) setShowMenu(false);
      }}
      header={
        <View style={{ paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>HydGo Admin</Text>
          <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{user?.email}</Text>
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
      case 'overview': return renderOverview();
      case 'users': return renderUsers();
      case 'drivers': return renderDrivers();
      case 'routes': return renderRouteMonitor();
      case 'payments': return renderPayments();
      case 'reports': return renderReports();
      case 'analytics': return renderAnalytics();
      case 'disputes': return renderDisputes();
      case 'notifications': return renderNotifications();
      case 'settings': return renderSettings();
      case 'admins': return renderAdminMgmt();
      default: return renderOverview();
    }
  };

  // ── OVERVIEW ──────────────────────────────────────────────────────────────
  const renderOverview = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(300).delay(50)}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 20 }}>
          Dashboard Overview
        </Text>

        {/* Top Metrics */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatCard label="Total Users" value={12480} />
          <StatCard label="Total Drivers" value={842} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatCard label="Active Trips" value={67} />
          <StatCard label="Revenue Today" value={184500} prefix="₹" />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          <StatCard label="Revenue (Month)" value={4250000} prefix="₹" />
          <StatCard label="Pending Approvals" value={3} />
        </View>
      </Animated.View>

      {/* Quick Actions */}
      <Animated.View entering={FadeInDown.duration(300).delay(150)}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
          Quick Actions
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {[
            { icon: 'person-add-outline' as const, label: 'Add Admin' },
            { icon: 'bus-outline' as const, label: 'Approve Drivers' },
            { icon: 'megaphone-outline' as const, label: 'Send Notification' },
            { icon: 'download-outline' as const, label: 'Export Data' },
          ].map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                if (action.label === 'Approve Drivers') setActiveTab('drivers');
                if (action.label === 'Add Admin') setActiveTab('admins');
                if (action.label === 'Send Notification') setActiveTab('notifications');
              }}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#1A1A1A',
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Ionicons name={action.icon} size={20} color="#888" />
              <Text style={{ color: '#ccc', fontSize: 10, fontWeight: '600', textAlign: 'center' }}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* Recent Activity */}
      <Animated.View entering={FadeInDown.duration(300).delay(250)}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
          Recent Activity
        </Text>
        {[
          { icon: 'person-add' as const, text: 'New driver application: Ravi Kumar', time: '2 min ago', color: '#4CAF50' },
          { icon: 'alert-circle' as const, text: 'Dispute #1042 filed by Ananya M.', time: '15 min ago', color: '#FFC107' },
          { icon: 'checkmark-circle' as const, text: 'Driver Sanjay P. approved', time: '1 hr ago', color: '#4CAF50' },
          { icon: 'cash' as const, text: 'Refund ₹240 processed for trip #8821', time: '2 hr ago', color: '#2196F3' },
          { icon: 'trending-up' as const, text: 'Peak hour schedule updated: MGBS Depot', time: '3 hr ago', color: '#FF9800' },
        ].map((activity, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#0d0d0d',
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#111',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={activity.icon} size={16} color={activity.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ccc', fontSize: 12 }}>{activity.text}</Text>
            </View>
            <Text style={{ color: '#555', fontSize: 10 }}>{activity.time}</Text>
          </View>
        ))}
      </Animated.View>

      {/* System Health */}
      <Animated.View entering={FadeInDown.duration(300).delay(350)}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 12 }}>
          System Health
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { label: 'API', status: 'Healthy' },
            { label: 'Database', status: 'Healthy' },
            { label: 'Redis', status: 'Healthy' },
            { label: 'WebSocket', status: 'Healthy' },
          ].map((sys) => (
            <View
              key={sys.label}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#1A1A1A',
                borderRadius: 10,
                padding: 12,
                alignItems: 'center',
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginBottom: 6 }} />
              <Text style={{ color: '#888', fontSize: 10, fontWeight: '600' }}>{sys.label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </ScrollView>
  );

  // ── USERS ─────────────────────────────────────────────────────────────────
  const renderUsers = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 }}>
        User Management
      </Text>

      {/* Search */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 10,
            paddingHorizontal: 12,
            gap: 8,
          }}
        >
          <Ionicons name="search" size={16} color="#555" />
          <TextInput
            placeholder="Search users..."
            placeholderTextColor="#555"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ flex: 1, color: '#fff', fontSize: 13, paddingVertical: 10 }}
          />
        </View>
        <Pressable
          style={{
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 10,
            paddingHorizontal: 14,
            justifyContent: 'center',
          }}
        >
          <Ionicons name="filter" size={16} color="#888" />
        </Pressable>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: '#1A1A1A', borderRadius: 10, padding: 14 }}>
          <Text style={{ color: '#666', fontSize: 11 }}>Active</Text>
          <Text style={{ color: '#4CAF50', fontSize: 18, fontWeight: '800' }}>11,820</Text>
        </View>
        <View style={{ flex: 1, borderWidth: 1, borderColor: '#1A1A1A', borderRadius: 10, padding: 14 }}>
          <Text style={{ color: '#666', fontSize: 11 }}>Suspended</Text>
          <Text style={{ color: '#ff4444', fontSize: 18, fontWeight: '800' }}>42</Text>
        </View>
        <View style={{ flex: 1, borderWidth: 1, borderColor: '#1A1A1A', borderRadius: 10, padding: 14 }}>
          <Text style={{ color: '#666', fontSize: 11 }}>New Today</Text>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>86</Text>
        </View>
      </View>

      {/* User Table */}
      {[
        { name: 'Ananya M.', email: 'ananya@email.com', trips: 45, status: 'Active', joined: 'Jan 2026' },
        { name: 'Vikram R.', email: 'vikram@email.com', trips: 128, status: 'Active', joined: 'Dec 2025' },
        { name: 'Priya D.', email: 'priya@email.com', trips: 12, status: 'Active', joined: 'Feb 2026' },
        { name: 'Arjun M.', email: 'arjun@email.com', trips: 0, status: 'Suspended', joined: 'Jan 2026' },
        { name: 'Sita N.', email: 'sita@email.com', trips: 67, status: 'Active', joined: 'Nov 2025' },
      ].map((u) => (
        <View
          key={u.email}
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
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#888', fontSize: 14, fontWeight: '700' }}>{u.name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{u.name}</Text>
            <Text style={{ color: '#555', fontSize: 11 }}>{u.email}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#888', fontSize: 11 }}>{u.trips} trips</Text>
            <Text
              style={{
                color: u.status === 'Active' ? '#4CAF50' : '#ff4444',
                fontSize: 10,
                fontWeight: '600',
                marginTop: 2,
              }}
            >
              {u.status}
            </Text>
          </View>
          <Pressable hitSlop={8}>
            <Ionicons name="ellipsis-vertical" size={16} color="#555" />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );

  // ── DRIVERS ───────────────────────────────────────────────────────────────
  // ── DRIVERS (APPROVALS) ───────────────────────────────────────────────────
  const [pendingDriverList, setPendingDriverList] = useState<any[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  const fetchPendingDrivers = async () => {
    try {
      setLoadingDrivers(true);
      const response = await api.get('/admin/drivers/pending');
      if (response.data.success) {
        setPendingDriverList(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch pending drivers:', error);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const handleApproveDriver = async (driverId: string) => {
    try {
      const response = await api.patch(`/admin/drivers/${driverId}/approve`);
      if (response.data.success) {
        // Remove from pending list
        setPendingDriverList(prev => prev.filter(d => d.id !== driverId));
        // Update pending count
        setPendingDrivers(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to approve driver:', error);
    }
  };

  const handleRejectDriver = async (driverId: string) => {
    try {
      const response = await api.patch(`/admin/drivers/${driverId}/reject`);
      if (response.data.success) {
        // Remove from pending list
        setPendingDriverList(prev => prev.filter(d => d.id !== driverId));
        // Update pending count
        setPendingDrivers(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to reject driver:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'drivers') {
      fetchPendingDrivers();
    }
  }, [activeTab]);

  const renderDrivers = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
          Driver Management
        </Text>
        <Pressable onPress={fetchPendingDrivers} hitSlop={8}>
          <Ionicons name="refresh" size={20} color="#888" />
        </Pressable>
      </View>

      {/* Pending Approvals */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: '#FFC107', fontSize: 14, fontWeight: '700', marginBottom: 12 }}>
          Pending Approvals ({pendingDriverList.length})
        </Text>
        
        {loadingDrivers ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : pendingDriverList.length === 0 ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: '#1A1A1A',
              borderRadius: 14,
              padding: 40,
              alignItems: 'center',
            }}
          >
            <Ionicons name="checkmark-circle-outline" size={48} color="#333" />
            <Text style={{ color: '#666', fontSize: 14, marginTop: 12 }}>
              No pending approvals
            </Text>
          </View>
        ) : (
          pendingDriverList.map((driver) => (
            <View
              key={driver.id}
              style={{
                borderWidth: 1,
                borderColor: '#1a1400',
                borderRadius: 14,
                padding: 16,
                marginBottom: 10,
                backgroundColor: '#0a0a00',
              }}
            >
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                  {driver.fullName}
                </Text>
                <Text style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
                  {driver.email}
                </Text>
                <Text style={{ color: '#666', fontSize: 11, marginTop: 1 }}>
                  License: {driver.licenseNumber} · {new Date(driver.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => handleRejectDriver(driver.id)}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: '#ff4444',
                    borderRadius: 8,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#ff4444', fontSize: 12, fontWeight: '600' }}>Reject</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleApproveDriver(driver.id)}
                  style={{
                    flex: 1,
                    backgroundColor: '#fff',
                    borderRadius: 8,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>Approve</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  // ── ROUTE MONITOR ──────────────────────────────────────────────────────────
  const renderRouteMonitor = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 }}>
        Live Route Monitor
      </Text>

      {/* Live Stats */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <StatCard label="Active Now" value={67} />
        <StatCard label="Completed Today" value={1284} />
        <StatCard label="Cancelled" value={42} />
      </View>

      {/* Map Placeholder */}
      <View
        style={{
          height: 200,
          borderWidth: 1,
          borderColor: '#1A1A1A',
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          backgroundColor: '#050505',
        }}
      >
        <Ionicons name="map-outline" size={32} color="#333" />
        <Text style={{ color: '#444', fontSize: 12, marginTop: 8 }}>Live Map View</Text>
        <Text style={{ color: '#333', fontSize: 10, marginTop: 2 }}>67 active buses across Hyderabad</Text>
      </View>

      {/* Active Routes */}
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
        Active Routes
      </Text>
      {[
        { id: 'Route 10K', driver: 'Sanjay P.', bus: 'TS 09 F 4521', from: 'MGBS', to: 'Miyapur', status: 'In Transit', eta: '18 min' },
        { id: 'Route 216', driver: 'Rajesh V.', bus: 'TS 09 G 2210', from: 'Secunderabad', to: 'Mehdipatnam', status: 'At Stop', eta: '2 min' },
        { id: 'Route 5K', driver: 'Naresh D.', bus: 'TS 09 H 1105', from: 'JBS', to: 'ECIL', status: 'In Transit', eta: '25 min' },
      ].map((route) => (
        <View
          key={route.id}
          style={{
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 14,
            padding: 16,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{route.id}</Text>
            <Text
              style={{
                color: route.status === 'In Transit' ? '#4CAF50' : '#FFC107',
                fontSize: 11,
                fontWeight: '600',
              }}
            >
              {route.status} · {route.eta}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: '#888', fontSize: 11 }}>Driver: {route.driver}</Text>
            <Text style={{ color: '#888', fontSize: 11 }}>Bus: {route.bus}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#4CAF50' }} />
            <Text style={{ color: '#666', fontSize: 11, flex: 1 }}>{route.from}</Text>
            <Text style={{ color: '#444', fontSize: 11 }}>→</Text>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#ff4444' }} />
            <Text style={{ color: '#666', fontSize: 11, flex: 1, textAlign: 'right' }}>{route.to}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // ── PAYMENTS ──────────────────────────────────────────────────────────────
  const renderPayments = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 }}>
        Payments & Transactions
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <StatCard label="Revenue Today" value={184500} prefix="₹" />
        <StatCard label="Commission" value={36900} prefix="₹" />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <StatCard label="Pending Payouts" value={420000} prefix="₹" />
        <StatCard label="Refunds Today" value={2400} prefix="₹" />
      </View>

      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
        Recent Transactions
      </Text>
      {[
        { id: 'TXN-9021', type: 'Ticket Collection', amount: '₹280', from: 'Route 10K', status: 'Completed', time: '10:42 AM' },
        { id: 'TXN-9020', type: 'Driver Payout', amount: '₹8,420', from: 'Sanjay P.', status: 'Processing', time: '10:00 AM' },
        { id: 'TXN-9019', type: 'Refund', amount: '-₹240', from: 'Arjun M.', status: 'Completed', time: '9:30 AM' },
        { id: 'TXN-9018', type: 'Ticket Collection', amount: '₹180', from: 'Route 216', status: 'Completed', time: '9:15 AM' },
        { id: 'TXN-9017', type: 'Commission', amount: '₹56', from: 'Route 5K', status: 'Settled', time: '9:10 AM' },
      ].map((txn) => (
        <View
          key={txn.id}
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
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: '#111',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={
                txn.type === 'Refund' ? 'arrow-back' :
                txn.type === 'Driver Payout' ? 'arrow-forward' :
                'card-outline'
              }
              size={16}
              color={txn.type === 'Refund' ? '#ff4444' : '#4CAF50'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{txn.type}</Text>
            <Text style={{ color: '#555', fontSize: 10 }}>{txn.id} · {txn.from}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text
              style={{
                color: txn.amount.startsWith('-') ? '#ff4444' : '#fff',
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              {txn.amount}
            </Text>
            <Text style={{ color: '#555', fontSize: 10, marginTop: 2 }}>{txn.time}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // ── REPORTS ───────────────────────────────────────────────────────────────
  const renderReports = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 }}>
        Reports
      </Text>
      {[
        { title: 'Revenue Report', desc: 'Daily, weekly, monthly earnings', icon: 'cash-outline' as const },
        { title: 'Route Report', desc: 'Route statistics and trends', icon: 'bus-outline' as const },
        { title: 'Driver Performance', desc: 'Ratings, acceptance, completion rates', icon: 'person-outline' as const },
        { title: 'User Growth', desc: 'Sign-ups, retention, churn', icon: 'trending-up-outline' as const },
        { title: 'Dispute Summary', desc: 'Open, resolved, escalated cases', icon: 'warning-outline' as const },
        { title: 'Financial Summary', desc: 'Commission, payouts, refunds', icon: 'wallet-outline' as const },
      ].map((report) => (
        <Pressable
          key={report.title}
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
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={report.icon} size={20} color="#888" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{report.title}</Text>
            <Text style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{report.desc}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable
              style={{
                borderWidth: 1,
                borderColor: '#1A1A1A',
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: '#888', fontSize: 10, fontWeight: '600' }}>CSV</Text>
            </Pressable>
            <Pressable
              style={{
                borderWidth: 1,
                borderColor: '#1A1A1A',
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: '#888', fontSize: 10, fontWeight: '600' }}>PDF</Text>
            </Pressable>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );

  // ── ANALYTICS ─────────────────────────────────────────────────────────────
  const renderAnalytics = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 }}>
        Analytics
      </Text>

      {/* Key Metrics */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <StatCard label="Avg Ticket Fare" value={185} prefix="₹" />
        <StatCard label="Avg Route Distance" value={6.2} suffix=" km" />
      </View>

      {/* Charts Placeholder */}
      {[
        { title: 'Revenue Trend', subtitle: 'Last 30 days', height: 160 },
        { title: 'Route Volume', subtitle: 'Hourly distribution', height: 140 },
        { title: 'User Acquisition', subtitle: 'Weekly new sign-ups', height: 140 },
      ].map((chart) => (
        <View
          key={chart.title}
          style={{
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 14,
            padding: 18,
            marginBottom: 14,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{chart.title}</Text>
          <Text style={{ color: '#555', fontSize: 11, marginTop: 2, marginBottom: 14 }}>{chart.subtitle}</Text>
          <View
            style={{
              height: chart.height,
              borderWidth: 1,
              borderColor: '#0d0d0d',
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#050505',
            }}
          >
            <Ionicons name="bar-chart-outline" size={28} color="#222" />
            <Text style={{ color: '#333', fontSize: 10, marginTop: 6 }}>Chart Visualization</Text>
          </View>
        </View>
      ))}

      {/* Peak Hours */}
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
        Peak Hours
      </Text>
      {[
        { hour: '8-9 AM', trips: 142, surge: 'High' },
        { hour: '9-10 AM', trips: 198, surge: 'Peak' },
        { hour: '5-6 PM', trips: 165, surge: 'High' },
        { hour: '6-7 PM', trips: 210, surge: 'Peak' },
        { hour: '7-8 PM', trips: 178, surge: 'High' },
      ].map((p) => (
        <View
          key={p.hour}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: '#0d0d0d',
          }}
        >
          <Text style={{ color: '#888', fontSize: 12, width: 80 }}>{p.hour}</Text>
          <View style={{ flex: 1, height: 4, backgroundColor: '#1A1A1A', borderRadius: 2, marginHorizontal: 12 }}>
            <View style={{ width: `${(p.trips / 210) * 100}%`, height: 4, backgroundColor: '#fff', borderRadius: 2 }} />
          </View>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', width: 40, textAlign: 'right' }}>{p.trips}</Text>
          <Text style={{ color: '#FFC107', fontSize: 10, fontWeight: '600', width: 40, textAlign: 'right' }}>{p.surge}</Text>
        </View>
      ))}
    </ScrollView>
  );

  // ── DISPUTES ──────────────────────────────────────────────────────────────
  const renderDisputes = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 }}>
        Disputes
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: '#1A1A1A', borderRadius: 10, padding: 14 }}>
          <Text style={{ color: '#666', fontSize: 11 }}>Open</Text>
          <Text style={{ color: '#FFC107', fontSize: 20, fontWeight: '800' }}>5</Text>
        </View>
        <View style={{ flex: 1, borderWidth: 1, borderColor: '#1A1A1A', borderRadius: 10, padding: 14 }}>
          <Text style={{ color: '#666', fontSize: 11 }}>In Review</Text>
          <Text style={{ color: '#2196F3', fontSize: 20, fontWeight: '800' }}>3</Text>
        </View>
        <View style={{ flex: 1, borderWidth: 1, borderColor: '#1A1A1A', borderRadius: 10, padding: 14 }}>
          <Text style={{ color: '#666', fontSize: 11 }}>Resolved</Text>
          <Text style={{ color: '#4CAF50', fontSize: 20, fontWeight: '800' }}>128</Text>
        </View>
      </View>

      {[
        { id: '#1042', user: 'Ananya M.', reason: 'Overcharged for ticket', trip: '#8821', status: 'Open', priority: 'High', date: 'Feb 15' },
        { id: '#1041', user: 'Vikram R.', reason: 'Driver was rude', trip: '#8815', status: 'In Review', priority: 'Medium', date: 'Feb 14' },
        { id: '#1040', user: 'Priya D.', reason: 'Wrong route taken', trip: '#8810', status: 'Open', priority: 'Low', date: 'Feb 14' },
        { id: '#1039', user: 'Ravi K.', reason: 'Missed stop dispute', trip: '#8805', status: 'Open', priority: 'Medium', date: 'Feb 13' },
        { id: '#1038', user: 'Sita N.', reason: 'Bus condition poor', trip: '#8800', status: 'In Review', priority: 'High', date: 'Feb 13' },
      ].map((d) => (
        <View
          key={d.id}
          style={{
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 14,
            padding: 16,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{d.id}</Text>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: d.priority === 'High' ? '#1a0000' : d.priority === 'Medium' ? '#1a1400' : '#111',
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: '700',
                    color: d.priority === 'High' ? '#ff4444' : d.priority === 'Medium' ? '#FFC107' : '#888',
                  }}
                >
                  {d.priority}
                </Text>
              </View>
            </View>
            <Text
              style={{
                color: d.status === 'Open' ? '#FFC107' : '#2196F3',
                fontSize: 11,
                fontWeight: '600',
              }}
            >
              {d.status}
            </Text>
          </View>
          <Text style={{ color: '#ccc', fontSize: 12 }}>{d.reason}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: '#555', fontSize: 10 }}>{d.user} · Trip {d.trip}</Text>
            <Text style={{ color: '#444', fontSize: 10 }}>{d.date}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable style={{ flex: 1, borderWidth: 1, borderColor: '#1A1A1A', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ color: '#888', fontSize: 11, fontWeight: '600' }}>View Details</Text>
            </Pressable>
            <Pressable style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>Resolve</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  const renderNotifications = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 }}>
        Notifications
      </Text>

      {/* Send Notification */}
      <View
        style={{
          borderWidth: 1,
          borderColor: '#1A1A1A',
          borderRadius: 14,
          padding: 18,
          marginBottom: 24,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 12 }}>
          Send Push Notification
        </Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 10,
            paddingHorizontal: 14,
            marginBottom: 10,
          }}
        >
          <TextInput
            placeholder="Notification title..."
            placeholderTextColor="#555"
            style={{ color: '#fff', fontSize: 13, paddingVertical: 12 }}
          />
        </View>
        <View
          style={{
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 10,
            paddingHorizontal: 14,
            marginBottom: 12,
          }}
        >
          <TextInput
            placeholder="Message body..."
            placeholderTextColor="#555"
            multiline
            numberOfLines={3}
            style={{ color: '#fff', fontSize: 13, paddingVertical: 12, textAlignVertical: 'top' }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          {['All Users', 'Drivers', 'Passengers'].map((target, i) => (
            <Pressable
              key={target}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: i === 0 ? '#fff' : '#1A1A1A',
                backgroundColor: i === 0 ? '#fff' : 'transparent',
                borderRadius: 8,
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: i === 0 ? '#000' : '#888', fontSize: 11, fontWeight: '600' }}>{target}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={{
            backgroundColor: '#fff',
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#000', fontSize: 14, fontWeight: '700' }}>Send Notification</Text>
        </Pressable>
      </View>

      {/* Recent */}
      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 12 }}>
        Recently Sent
      </Text>
      {[
        { title: 'Weekend Bonus Active!', target: 'Drivers', sent: '2 hr ago', reach: '842' },
        { title: 'New areas now available', target: 'All Users', sent: '1 day ago', reach: '13,322' },
        { title: 'Rate update effective Mar 1', target: 'All Users', sent: '3 days ago', reach: '13,100' },
      ].map((n) => (
        <View
          key={n.title}
          style={{
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 12,
            padding: 14,
            marginBottom: 8,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{n.title}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: '#555', fontSize: 10 }}>To: {n.target} · {n.sent}</Text>
            <Text style={{ color: '#888', fontSize: 10 }}>Reached {n.reach}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  const renderSettings = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 }}>
        Platform Settings
      </Text>

      {/* Pricing */}
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
        Pricing & Commission
      </Text>
      {[
        { label: 'Ordinary Fare (base)', value: '₹15' },
        { label: 'Express Fare (base)', value: '₹35' },
        { label: 'Deluxe Fare (base)', value: '₹60' },
        { label: 'Per Km Surcharge', value: '₹1.50' },
        { label: 'Platform Fee', value: '₹5' },
        { label: 'Pass Discount', value: '15%' },
      ].map((s, i, arr) => (
        <View
          key={s.label}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 13,
            borderBottomWidth: i < arr.length - 1 ? 1 : 0,
            borderBottomColor: '#0d0d0d',
          }}
        >
          <Text style={{ color: '#888', fontSize: 13 }}>{s.label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{s.value}</Text>
            <Ionicons name="pencil-outline" size={12} color="#555" />
          </View>
        </View>
      ))}

      {/* Surge */}
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 12 }}>
        Peak Demand Settings
      </Text>
      {[
        { label: 'Peak Pricing Enabled', value: 'Yes' },
        { label: 'Max Multiplier', value: '1.5x' },
        { label: 'Trigger Threshold', value: '90% occupancy' },
        { label: 'Cool-down Period', value: '30 min' },
      ].map((s, i, arr) => (
        <View
          key={s.label}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 13,
            borderBottomWidth: i < arr.length - 1 ? 1 : 0,
            borderBottomColor: '#0d0d0d',
          }}
        >
          <Text style={{ color: '#888', fontSize: 13 }}>{s.label}</Text>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{s.value}</Text>
        </View>
      ))}

      {/* General */}
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 12 }}>
        General
      </Text>
      {[
        { icon: 'globe-outline' as const, label: 'Service Areas', desc: 'Hyderabad, Secunderabad' },
        { icon: 'time-outline' as const, label: 'Operating Hours', desc: '24/7' },
        { icon: 'language-outline' as const, label: 'Languages', desc: 'English, Telugu, Hindi' },
        { icon: 'shield-outline' as const, label: 'Safety Features', desc: 'SOS, Share Journey, OTP Verification' },
      ].map((item) => (
        <Pressable
          key={item.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: '#0d0d0d',
          }}
        >
          <Ionicons name={item.icon} size={18} color="#666" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{item.label}</Text>
            <Text style={{ color: '#555', fontSize: 11, marginTop: 2 }}>{item.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#444" />
        </Pressable>
      ))}
    </ScrollView>
  );

  // ── ADMIN MGMT ────────────────────────────────────────────────────────────
  const renderAdminMgmt = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 }}>
        Admin Management
      </Text>

      {/* Create Admin */}
      <Pressable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: '#fff',
          borderRadius: 10,
          paddingVertical: 14,
          marginBottom: 20,
        }}
      >
        <Ionicons name="person-add" size={18} color="#000" />
        <Text style={{ color: '#000', fontSize: 14, fontWeight: '700' }}>Create New Admin</Text>
      </Pressable>

      {/* Admins List */}
      {[
        { name: 'Super Admin', email: 'admin@hydgo.com', role: 'Super Admin', lastActive: 'Now', permissions: 'Full Access' },
        { name: 'Operations Lead', email: 'ops@hydgo.com', role: 'Operations', lastActive: '2 hr ago', permissions: 'Routes, Drivers, Disputes' },
        { name: 'Finance Manager', email: 'finance@hydgo.com', role: 'Finance', lastActive: '1 day ago', permissions: 'Payments, Reports' },
      ].map((admin) => (
        <View
          key={admin.email}
          style={{
            borderWidth: 1,
            borderColor: '#1A1A1A',
            borderRadius: 14,
            padding: 16,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{admin.name}</Text>
              <Text style={{ color: '#555', fontSize: 11 }}>{admin.email}</Text>
            </View>
            <View
              style={{
                backgroundColor: '#111',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: '#888', fontSize: 10, fontWeight: '600' }}>{admin.role}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#555', fontSize: 10 }}>Permissions: {admin.permissions}</Text>
            <Text style={{ color: '#444', fontSize: 10 }}>Active: {admin.lastActive}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable style={{ flex: 1, borderWidth: 1, borderColor: '#1A1A1A', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ color: '#888', fontSize: 11, fontWeight: '600' }}>Edit Permissions</Text>
            </Pressable>
            <Pressable style={{ flex: 1, borderWidth: 1, borderColor: '#ff4444', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ color: '#ff4444', fontSize: 11, fontWeight: '600' }}>Revoke Access</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {/* Audit Log */}
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 12 }}>
        Recent Admin Activity
      </Text>
      {[
        { action: 'Approved driver Sanjay P.', admin: 'Operations Lead', time: '1 hr ago' },
        { action: 'Issued refund ₹240 for Trip #8821', admin: 'Finance Manager', time: '2 hr ago' },
        { action: 'Updated surge multiplier to 2.0x', admin: 'Super Admin', time: '3 hr ago' },
        { action: 'Resolved dispute #1037', admin: 'Operations Lead', time: '5 hr ago' },
      ].map((log, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            gap: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: '#0d0d0d',
          }}
        >
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#333', marginTop: 6 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ccc', fontSize: 12 }}>{log.action}</Text>
            <Text style={{ color: '#555', fontSize: 10, marginTop: 2 }}>
              {log.admin} · {log.time}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // ── MAIN RENDER ───────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Header */}
      <HeaderBar
        title="HydGo Admin"
        subtitle="Control Panel"
        right={
          <>
            <NotificationBell count={8} onPress={() => setActiveTab('notifications')} />
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

        {/* Notification Center */}
        <NotificationCenter
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          onCountChange={setNotificationCount}
        />

        {/* Content */}
        <View style={{ flex: 1 }}>{renderContent()}</View>
      </View>
    </View>
  );
}
