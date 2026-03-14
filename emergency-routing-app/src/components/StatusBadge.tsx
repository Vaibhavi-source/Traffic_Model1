import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getCongestionColor, getCongestionLabel } from '@/utils/congestion.utils';
import { RADIUS } from '@/config/theme';

interface StatusBadgeProps {
  score: number;
}

export function StatusBadge({ score }: StatusBadgeProps): React.JSX.Element {
  const color = getCongestionColor(score);
  const label = getCongestionLabel(score);

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.text}>{label.toUpperCase()}</Text>
    </View>
  );
}

export default StatusBadge;

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: RADIUS.PILL,
  },
  text: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
