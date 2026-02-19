// ── Support Screen ──────────────────────────────────────────────────────────
// Help center with quick actions, FAQ, and emergency contact.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Platform, ScrollView,
  TouchableOpacity, TextInput, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface QuickAction {
  icon: IoniconsName;
  label: string;
  sub: string;
  color: string;
  action: () => void;
}

interface FAQ {
  q: string;
  a: string;
}

const FAQS: FAQ[] = [
  { q: 'How do I track a bus in real-time?', a: "Open the Home tab and tap any bus marker on the map. You'll see the route, ETA, and live occupancy. You can also search for a route in the search bar." },
  { q: 'How does Smart Pass work?', a: 'Smart Pass is a weekly/monthly prepaid pass that gives unlimited rides on select routes. Activate from the Wallet tab and it auto-deducts zero fare per ride.' },
  { q: 'Why is my ETA different from arrival?', a: "ETAs use live traffic + historical patterns. Unexpected congestion, signals, or diversions can cause minor variations. HydGo's AI continuously improves accuracy." },
  { q: 'How do I save my favorite routes?', a: 'On the Routes tab, tap the heart icon on any route card. Saved routes appear at the top for quick access.' },
  { q: 'What is the Reliability Score?', a: "It is a 0-100 score based on how often a bus arrives within 3 minutes of its predicted time, calculated from the last 30 days of data." },
  { q: 'Can I get alerts for my bus?', a: "Yes! Tap the bell icon on any tracked bus card. You'll receive push notifications when it is 5, 3, and 1 stops away." },
];

export default function Support() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [searchQ, setSearchQ] = useState('');

  const quickActions: QuickAction[] = [
    {
      icon: 'chatbubbles',
      label: 'Live Chat',
      sub: 'Avg wait ~2 min',
      color: '#6366F1',
      action: () => {},
    },
    {
      icon: 'call',
      label: 'Call Support',
      sub: '040-2345-6789',
      color: '#10B981',
      action: () => Linking.openURL('tel:04023456789'),
    },
    {
      icon: 'warning',
      label: 'Report Issue',
      sub: 'Route, driver, safety',
      color: '#F59E0B',
      action: () => {},
    },
    {
      icon: 'shield-checkmark',
      label: 'Emergency',
      sub: 'SOS · Dial 112',
      color: '#EF4444',
      action: () => Linking.openURL('tel:112'),
    },
  ];

  const filteredFaqs = searchQ.trim()
    ? FAQS.filter(
        (f) =>
          f.q.toLowerCase().includes(searchQ.toLowerCase()) ||
          f.a.toLowerCase().includes(searchQ.toLowerCase()),
      )
    : FAQS;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerTitle}>Support</Text>
      <Text style={styles.headerSub}>How can we help you today?</Text>

      {/* Quick Actions */}
      <View style={styles.quickGrid}>
        {quickActions.map((qa, i) => (
          <TouchableOpacity key={i} style={styles.quickCard} activeOpacity={0.7} onPress={qa.action}>
            <View style={[styles.quickIcon, { backgroundColor: qa.color + '18' }]}>
              <Ionicons name={qa.icon} size={20} color={qa.color} />
            </View>
            <Text style={styles.quickLabel}>{qa.label}</Text>
            <Text style={styles.quickSub}>{qa.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FAQ Search */}
      <View style={styles.faqSearchWrap}>
        <Ionicons name="search" size={16} color={Theme.textMuted} />
        <TextInput
          style={styles.faqSearchInput}
          placeholder="Search FAQs..."
          placeholderTextColor={Theme.textMuted}
          value={searchQ}
          onChangeText={setSearchQ}
        />
      </View>

      {/* FAQs */}
      <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
      {filteredFaqs.map((faq, idx) => {
        const open = expandedFaq === idx;
        return (
          <TouchableOpacity
            key={idx}
            style={[styles.faqCard, open && styles.faqCardOpen]}
            activeOpacity={0.7}
            onPress={() => setExpandedFaq(open ? null : idx)}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQ}>{faq.q}</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Theme.textMuted} />
            </View>
            {open && <Text style={styles.faqA}>{faq.a}</Text>}
          </TouchableOpacity>
        );
      })}

      {/* Rate App */}
      <TouchableOpacity style={styles.rateCard} activeOpacity={0.7}>
        <Ionicons name="star" size={20} color="#F59E0B" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.rateTitle}>Enjoying HydGo?</Text>
          <Text style={styles.rateSub}>Rate us on the App Store — it helps a lot!</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Theme.textMuted} />
      </TouchableOpacity>

      {/* Version Info */}
      <Text style={styles.versionText}>HydGo v2.0.0 · Built with 💙 in Hyderabad</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.bg },
  content: {
    paddingTop: Platform.OS === 'web' ? 16 : 56,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  headerTitle: {
    fontSize: Theme.font.xxl,
    fontWeight: '700',
    color: Theme.text,
    paddingHorizontal: 4,
  },
  headerSub: {
    color: Theme.textSecondary,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  quickCard: {
    width: '48%' as unknown as number,
    flexBasis: '48%',
    flexGrow: 0,
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickLabel: {
    color: Theme.text,
    fontSize: 14,
    fontWeight: '700',
  },
  quickSub: {
    color: Theme.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  faqSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 10 : 0,
    gap: 8,
    borderWidth: 1,
    borderColor: Theme.border,
    marginBottom: 20,
  },
  faqSearchInput: {
    flex: 1,
    color: Theme.text,
    fontSize: 14,
    height: 40,
  },
  sectionTitle: {
    color: Theme.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  faqCard: {
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radiusSm,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  faqCardOpen: {
    borderColor: Theme.accent + '40',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQ: {
    flex: 1,
    color: Theme.text,
    fontSize: 13,
    fontWeight: '600',
  },
  faqA: {
    color: Theme.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
  },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B10',
    borderRadius: Theme.radiusSm,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F59E0B25',
  },
  rateTitle: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
  },
  rateSub: {
    color: Theme.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  versionText: {
    color: Theme.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 32,
  },
});
