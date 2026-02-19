/**
 * Admin Driver Approval Screen — Phase 9
 * Real-time driver approval workflow
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../lib/api';

interface PendingDriver {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  createdAt: string;
  userId: string;
}

export default function DriverApprovalsScreen() {
  const [drivers, setDrivers] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchPendingDrivers = async () => {
    try {
      const res = await api.get('/admin/drivers/pending');
      setDrivers(res.data.data);
    } catch (err) {
      console.error('Failed to fetch pending drivers', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPendingDrivers();

    // Poll every 10 seconds for new drivers
    const interval = setInterval(fetchPendingDrivers, 10000);

    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingDrivers();
  };

  const handleApprove = async (driverId: string) => {
    try {
      setProcessing(driverId);
      await api.patch(`/admin/drivers/${driverId}/approve`);
      fetchPendingDrivers();
    } catch (err: any) {
      console.error('Failed to approve driver', err);
      alert(err?.response?.data?.message || 'Failed to approve driver');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (driverId: string) => {
    try {
      setProcessing(driverId);
      await api.patch(`/admin/drivers/${driverId}/reject`);
      fetchPendingDrivers();
    } catch (err: any) {
      console.error('Failed to reject driver', err);
      alert(err?.response?.data?.message || 'Failed to reject driver');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>
            Pending Applications
          </Text>
          {drivers.length > 0 && (
            <View style={{
              backgroundColor: '#ff4400',
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                {drivers.length}
              </Text>
            </View>
          )}
        </View>

        {/* Empty State */}
        {drivers.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 100 }}>
            <Ionicons name="checkmark-done-circle" size={64} color="#333" />
            <Text style={{ color: '#666', fontSize: 16, marginTop: 16 }}>
              No pending applications
            </Text>
          </View>
        ) : (
          /* Driver Cards */
          drivers.map((driver) => (
            <View
              key={driver.id}
              style={{
                backgroundColor: '#111',
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: '#222',
              }}
            >
              {/* Driver Info */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
                  {driver.fullName}
                </Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="mail" size={14} color="#666" />
                  <Text style={{ color: '#999', fontSize: 13, marginLeft: 8 }}>
                    {driver.email}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="call" size={14} color="#666" />
                  <Text style={{ color: '#999', fontSize: 13, marginLeft: 8 }}>
                    {driver.phone}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="card" size={14} color="#666" />
                  <Text style={{ color: '#999', fontSize: 13, marginLeft: 8 }}>
                    {driver.licenseNumber}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="time" size={14} color="#666" />
                  <Text style={{ color: '#666', fontSize: 12, marginLeft: 8 }}>
                    Applied {formatDate(driver.createdAt)}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={() => handleApprove(driver.id)}
                  disabled={processing === driver.id}
                  style={{
                    flex: 1,
                    backgroundColor: processing === driver.id ? '#333' : '#00cc44',
                    borderRadius: 8,
                    paddingVertical: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {processing === driver.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                        Approve
                      </Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => handleReject(driver.id)}
                  disabled={processing === driver.id}
                  style={{
                    flex: 1,
                    backgroundColor: processing === driver.id ? '#333' : '#1a1a1a',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#ff4444',
                    paddingVertical: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {processing === driver.id ? (
                    <ActivityIndicator size="small" color="#ff4444" />
                  ) : (
                    <>
                      <Ionicons name="close-circle" size={18} color="#ff4444" />
                      <Text style={{ color: '#ff4444', fontSize: 14, fontWeight: '700' }}>
                        Reject
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
