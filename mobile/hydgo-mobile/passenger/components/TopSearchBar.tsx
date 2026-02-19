// ── Top Search Bar ──────────────────────────────────────────────────────────
// Premium From/To search bar with full TSRTC stop autocomplete.
// "From" auto-fills with live location, is editable.
// "To" field for destination. Both search all stops from the database.

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform,
  TextInput, FlatList, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Theme } from '../../constants/theme';
import { usePassengerStore } from '../store/passengerStore';
import { useAllStops } from '../hooks/useAllStops';
import type { StopInfo } from '../types';

const MAX_SUGGESTIONS = 8;

export function TopSearchBar() {
  const router = useRouter();
  const userLocationName = usePassengerStore((s) => s.userLocationName);
  const allStops = useAllStops();

  const [expanded, setExpanded] = useState(false);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);

  const fromRef = useRef<TextInput>(null);
  const toRef = useRef<TextInput>(null);

  // Auto-fill "From" with live location name
  useEffect(() => {
    if (userLocationName && !fromText) {
      setFromText(userLocationName);
    }
  }, [userLocationName]);

  // ── Fuzzy search across ALL database stops ────────────────────────────
  const filtered = useMemo<StopInfo[]>(() => {
    const query = activeField === 'from' ? fromText : toText;
    if (!query || query.trim().length < 1) {
      // Show popular stops when no query
      return allStops.slice(0, MAX_SUGGESTIONS);
    }
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/);

    return allStops
      .filter((s) => {
        const name = s.name.toLowerCase();
        // Match all words (so "kphb col" matches "KPHB Colony")
        return words.every((w) => name.includes(w));
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [fromText, toText, activeField, allStops]);

  const showDropdown = expanded && activeField !== null && filtered.length > 0;

  // ── Expand the search bar ─────────────────────────────────────────────
  const handleExpand = useCallback(() => {
    setExpanded(true);
    setActiveField('to');
    setTimeout(() => toRef.current?.focus(), 100);
  }, []);

  // ── Collapse & Reset ─────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setExpanded(false);
    setActiveField(null);
    setToText('');
    if (userLocationName) setFromText(userLocationName);
    Keyboard.dismiss();
  }, [userLocationName]);

  // ── Select a stop from dropdown ───────────────────────────────────────
  const handleSelectStop = useCallback(
    (stop: StopInfo) => {
      if (activeField === 'from') {
        setFromText(stop.name);
        // After selecting from, focus "to"
        setActiveField('to');
        setTimeout(() => toRef.current?.focus(), 100);
      } else {
        setToText(stop.name);
        setActiveField(null);
        Keyboard.dismiss();

        // Navigate to directions with from/to pre-filled
        router.push({
          pathname: '/(app)/passenger/directions' as any,
          params: {
            fromName: fromText || userLocationName || 'Current Location',
            toStopId: stop.id,
            toStopName: stop.name,
          },
        });
        // Reset after navigation
        setTimeout(() => {
          setExpanded(false);
          setToText('');
          if (userLocationName) setFromText(userLocationName);
        }, 300);
      }
    },
    [activeField, fromText, userLocationName, router],
  );

  // ── Swap from ↔ to ────────────────────────────────────────────────────
  const handleSwap = useCallback(() => {
    const temp = fromText;
    setFromText(toText);
    setToText(temp);
  }, [fromText, toText]);

  // ── Render suggestion row ─────────────────────────────────────────────
  const renderSuggestion = useCallback(
    ({ item }: { item: StopInfo }) => (
      <Pressable
        style={styles.suggestionRow}
        onPress={() => handleSelectStop(item)}
      >
        <View style={styles.suggestionIcon}>
          <Ionicons name="bus" size={13} color={Theme.accent} />
        </View>
        <Text style={styles.suggestionName} numberOfLines={1}>
          {item.name}
        </Text>
        <Ionicons name="arrow-forward" size={12} color={Theme.textMuted} />
      </Pressable>
    ),
    [handleSelectStop],
  );

  // ── COLLAPSED STATE ───────────────────────────────────────────────────
  if (!expanded) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.collapsedBar} onPress={handleExpand}>
          <Ionicons name="search" size={18} color={Theme.textTertiary} />
          <View style={styles.collapsedTextArea}>
            <Text style={styles.collapsedPlaceholder}>Where do you want to go?</Text>
            {userLocationName ? (
              <Text style={styles.collapsedFrom} numberOfLines={1}>
                From {userLocationName}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              router.push('/(app)/passenger/profile' as any);
            }}
            style={styles.profileBtn}
            hitSlop={8}
          >
            <Ionicons name="person-circle-outline" size={26} color={Theme.textTertiary} />
          </Pressable>
        </Pressable>
      </View>
    );
  }

  // ── EXPANDED STATE (From/To) ──────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={[styles.expandedCard, showDropdown && styles.expandedCardOpen]}>
        {/* Header row with close button */}
        <View style={styles.headerRow}>
          <Pressable onPress={handleClose} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={Theme.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Plan your trip</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* From / To fields */}
        <View style={styles.fieldsContainer}>
          {/* Timeline dots */}
          <View style={styles.timeline}>
            <View style={[styles.dot, styles.dotGreen]} />
            <View style={styles.timelineLine} />
            <View style={[styles.dot, styles.dotRed]} />
          </View>

          {/* Input fields */}
          <View style={styles.fieldsColumn}>
            <Pressable
              style={[
                styles.fieldRow,
                activeField === 'from' && styles.fieldRowActive,
              ]}
              onPress={() => {
                setActiveField('from');
                fromRef.current?.focus();
              }}
            >
              <TextInput
                ref={fromRef}
                style={styles.fieldInput}
                value={fromText}
                onChangeText={(t) => {
                  setFromText(t);
                  setActiveField('from');
                }}
                onFocus={() => setActiveField('from')}
                placeholder="Your location"
                placeholderTextColor={Theme.textMuted}
                returnKeyType="next"
                onSubmitEditing={() => {
                  setActiveField('to');
                  toRef.current?.focus();
                }}
              />
              {fromText.length > 0 && activeField === 'from' && (
                <Pressable
                  onPress={() => setFromText('')}
                  hitSlop={8}
                  style={styles.clearBtn}
                >
                  <Ionicons name="close-circle" size={16} color={Theme.textMuted} />
                </Pressable>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.fieldRow,
                activeField === 'to' && styles.fieldRowActive,
              ]}
              onPress={() => {
                setActiveField('to');
                toRef.current?.focus();
              }}
            >
              <TextInput
                ref={toRef}
                style={styles.fieldInput}
                value={toText}
                onChangeText={(t) => {
                  setToText(t);
                  setActiveField('to');
                }}
                onFocus={() => setActiveField('to')}
                placeholder="Where to?"
                placeholderTextColor={Theme.textMuted}
                returnKeyType="search"
              />
              {toText.length > 0 && activeField === 'to' && (
                <Pressable
                  onPress={() => setToText('')}
                  hitSlop={8}
                  style={styles.clearBtn}
                >
                  <Ionicons name="close-circle" size={16} color={Theme.textMuted} />
                </Pressable>
              )}
            </Pressable>
          </View>

          {/* Swap button */}
          <Pressable onPress={handleSwap} style={styles.swapBtn} hitSlop={6}>
            <Ionicons name="swap-vertical" size={18} color={Theme.textTertiary} />
          </Pressable>
        </View>
      </View>

      {/* Autocomplete Dropdown */}
      {showDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={filtered}
            keyExtractor={(item) => `${item.id}-${item.name}`}
            renderItem={renderSuggestion}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={filtered.length > 5}
            style={{ maxHeight: 340 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 56,
    left: 16,
    right: 16,
    zIndex: 100,
  },

  // ── Collapsed bar ─────────────────────────────────────────────────────
  collapsedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radiusFull,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Theme.border,
    ...Theme.shadow,
  },
  collapsedTextArea: {
    flex: 1,
  },
  collapsedPlaceholder: {
    color: Theme.textTertiary,
    fontSize: Theme.font.lg,
    fontWeight: '400',
  },
  collapsedFrom: {
    color: Theme.textMuted,
    fontSize: Theme.font.sm,
    marginTop: 1,
  },
  profileBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Expanded card ─────────────────────────────────────────────────────
  expandedCard: {
    backgroundColor: Theme.bgCard,
    borderRadius: Theme.radius,
    borderWidth: 1,
    borderColor: Theme.border,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 14,
    ...Theme.shadow,
  },
  expandedCardOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomColor: Theme.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: Theme.text,
    fontSize: Theme.font.lg,
    fontWeight: '600',
  },

  // ── Fields ────────────────────────────────────────────────────────────
  fieldsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  timeline: {
    width: 14,
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: {
    backgroundColor: '#22C55E',
  },
  dotRed: {
    backgroundColor: '#EF4444',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: Theme.textMuted + '40',
    marginVertical: 4,
  },
  fieldsColumn: {
    flex: 1,
    gap: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.bgInput,
    borderRadius: Theme.radiusSm,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fieldRowActive: {
    borderColor: Theme.accent + '30',
    backgroundColor: Theme.bgElevated,
  },
  fieldInput: {
    flex: 1,
    color: Theme.text,
    fontSize: Theme.font.md,
    height: 38,
    padding: 0,
    margin: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  clearBtn: {
    padding: 4,
  },
  swapBtn: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Dropdown ──────────────────────────────────────────────────────────
  dropdown: {
    backgroundColor: Theme.bgCard,
    borderBottomLeftRadius: Theme.radius,
    borderBottomRightRadius: Theme.radius,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Theme.border,
    overflow: 'hidden',
    ...Theme.shadow,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.border,
  },
  suggestionIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: Theme.accent + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionName: {
    flex: 1,
    color: Theme.text,
    fontSize: Theme.font.md,
    fontWeight: '500',
  },
});
