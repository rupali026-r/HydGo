// ── Wallet Screen ───────────────────────────────────────────────────────────
// Digital wallet with balance, transactions, and smart pass suggestions.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Platform, ScrollView,
  TouchableOpacity, Animated as RNAnimated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';

interface Transaction {
  id: string;
  type: 'ride' | 'topup' | 'pass';
  amount: number;
  label: string;
  date: string;
  route?: string;
}

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', type: 'ride', amount: -30, label: 'Route 10K · KPHB → Secunderabad', date: 'Today, 9:15 AM', route: '10K' },
  { id: '2', type: 'ride', amount: -25, label: 'Route 216 · Miyapur → Ameerpet', date: 'Yesterday, 6:30 PM', route: '216' },
  { id: '3', type: 'topup', amount: 500, label: 'Added via UPI', date: 'Feb 15, 2026' },
  { id: '4', type: 'ride', amount: -30, label: 'Route 5K · JNTU → LB Nagar', date: 'Feb 14, 2026', route: '5K' },
  { id: '5', type: 'pass', amount: -380, label: 'Weekly Smart Pass', date: 'Feb 10, 2026' },
  { id: '6', type: 'topup', amount: 1000, label: 'Added via Card', date: 'Feb 8, 2026' },
];

export default function Wallet() {
  const [balance] = useState(1035);
  const animatedBalance = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(animatedBalance, {
      toValue: balance,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [balance]);

  const totalRides = MOCK_TRANSACTIONS.filter((t) => t.type === 'ride').length;
  const totalSpent = MOCK_TRANSACTIONS.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const avgPerTrip = totalRides > 0 ? Math.round(totalSpent / totalRides) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Text style={styles.headerTitle}>Wallet</Text>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>₹{balance.toLocaleString()}</Text>

        <View style={styles.balanceActions}>
          <TouchableOpacity style={styles.addMoneyBtn} activeOpacity={0.7}>
            <Ionicons name="add-circle" size={18} color={Theme.bg} />
            <Text style={styles.addMoneyText}>Add Money</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendBtn} activeOpacity={0.7}>
            <Ionicons name="send-outline" size={16} color={Theme.text} />
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Smart Pass Suggestion */}
      <View style={styles.passSuggestion}>
        <View style={styles.passIcon}>
          <Ionicons name="flash" size={18} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.passTitle}>Weekly Commuter?</Text>
          <Text style={styles.passSubtitle}>Save ₹120 with Smart Pass · ₹380/week</Text>
        </View>
        <TouchableOpacity style={styles.passBtn}>
          <Text style={styles.passBtnText}>Get</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalRides}</Text>
          <Text style={styles.statLabel}>Rides</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>₹{totalSpent}</Text>
          <Text style={styles.statLabel}>Spent</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>₹{avgPerTrip}</Text>
          <Text style={styles.statLabel}>Avg/Trip</Text>
        </View>
      </View>

      {/* Transactions */}
      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      {MOCK_TRANSACTIONS.map((tx) => (
        <View key={tx.id} style={styles.txRow}>
          <View style={[styles.txIcon, { backgroundColor: tx.amount > 0 ? '#065F4615' : '#EF444415' }]}>
            <Ionicons
              name={tx.type === 'topup' ? 'arrow-down' : tx.type === 'pass' ? 'flash' : 'bus'}
              size={16}
              color={tx.amount > 0 ? '#10B981' : '#EF4444'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.txLabel} numberOfLines={1}>{tx.label}</Text>
            <Text style={styles.txDate}>{tx.date}</Text>
          </View>
          <Text style={[styles.txAmount, { color: tx.amount > 0 ? '#10B981' : '#EF4444' }]}>
            {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.bg,
  },
  content: {
    paddingTop: Platform.OS === 'web' ? 16 : 56,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  headerTitle: {
    fontSize: Theme.font.xxl,
    fontWeight: '700',
    color: Theme.text,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  balanceCard: {
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: 24,
    borderWidth: 1,
    borderColor: Theme.border,
    marginBottom: 16,
  },
  balanceLabel: {
    color: Theme.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  balanceAmount: {
    color: Theme.text,
    fontSize: 40,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 20,
    letterSpacing: -1,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addMoneyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.accent,
    borderRadius: Theme.radiusSm,
    paddingVertical: 12,
    gap: 6,
  },
  addMoneyText: {
    color: Theme.bg,
    fontSize: 14,
    fontWeight: '700',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.bgElevated,
    borderRadius: Theme.radiusSm,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  sendText: {
    color: Theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  passSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B10',
    borderRadius: Theme.radiusSm,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F59E0B30',
    marginBottom: 16,
  },
  passIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F59E0B20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passTitle: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
  },
  passSubtitle: {
    color: Theme.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  passBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: Theme.radiusXs,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  passBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radiusSm,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.border,
  },
  statValue: {
    color: Theme.text,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: Theme.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    color: Theme.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txLabel: {
    color: Theme.text,
    fontSize: 13,
    fontWeight: '600',
  },
  txDate: {
    color: Theme.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
});
