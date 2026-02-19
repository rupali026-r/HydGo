import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

const ROLES = ['passenger', 'driver', 'admin'] as const;

interface RoleToggleProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function RoleToggle({ selectedIndex, onSelect }: RoleToggleProps) {
  const containerW = useSharedValue(0);
  const segIndex = useSharedValue(selectedIndex);

  const indicatorStyle = useAnimatedStyle(() => {
    const itemW = containerW.value / ROLES.length;
    return {
      width: itemW,
      transform: [{ translateX: segIndex.value * itemW }],
      opacity: containerW.value > 0 ? 1 : 0,
    };
  });

  const handleSelect = useCallback(
    (i: number) => {
      onSelect(i);
      segIndex.value = withTiming(i, { duration: 150 });
    },
    [onSelect],
  );

  return (
    <View
      onLayout={(e) => {
        containerW.value = e.nativeEvent.layout.width;
      }}
      style={{
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#1A1A1A',
        borderRadius: 10,
        marginBottom: 28,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            backgroundColor: '#fff',
            borderRadius: 9,
          },
          indicatorStyle,
        ]}
      />
      {ROLES.map((r, i) => (
        <Pressable
          key={r}
          onPress={() => handleSelect(i)}
          style={{
            flex: 1,
            paddingVertical: 13,
            alignItems: 'center',
            zIndex: 2,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              textTransform: 'capitalize',
              color: selectedIndex === i ? '#000' : '#888',
            }}
          >
            {r}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
