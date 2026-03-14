import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import type { PredictionResponse } from '@/types';
import { COLORS, SPACING, RADIUS } from '@/config/theme';
import {
  getCongestionColor,
  getCongestionLevel,
  formatLatency,
} from '@/utils/congestion.utils';
import { StatusBadge } from './StatusBadge';

interface CongestionCardProps {
  prediction: PredictionResponse;
  isSelected?: boolean;
}

const GRADIENT_MAP: Record<string, [string, string]> = {
  low: ['#0a2e1a', '#0d3d22'],
  moderate: ['#2e1a00', '#3d2a00'],
  high: ['#2e0a0a', '#3d1010'],
};

export function CongestionCard({ prediction, isSelected }: CongestionCardProps): React.JSX.Element {
  const level = getCongestionLevel(prediction.congestion_t5);
  const color = getCongestionColor(prediction.congestion_t5);
  const gradient = GRADIENT_MAP[level];

  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 14, stiffness: 90 });
    opacity.value = withSpring(1, { damping: 14, stiffness: 90 });
    return () => {
      translateY.value = 20;
      opacity.value = 0;
    };
  }, [prediction.city, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const horizons = [
    { label: 'T+10', value: prediction.congestion_t10 },
    { label: 'T+20', value: prediction.congestion_t20 },
    { label: 'T+30', value: prediction.congestion_t30 },
  ];

  return (
    <Animated.View style={[animatedStyle, isSelected && styles.selectedGlow]}>
      <LinearGradient colors={gradient} style={styles.card}>
        <View style={[styles.border, { borderColor: color + '80' }]}>
          {/* Row 1 */}
          <View style={styles.headerRow}>
            <Text style={styles.cityName}>{prediction.city}</Text>
            <StatusBadge score={prediction.congestion_t5} />
          </View>

          {/* Row 2 — main score */}
          <Text style={[styles.mainScore, { color }]}>
            {(prediction.congestion_t5 * 100).toFixed(1)}%
          </Text>
          <Text style={styles.subLabel}>T+5 Congestion</Text>

          {/* Row 3 — horizon grid */}
          <View style={styles.horizonGrid}>
            {horizons.map((h) => (
              <View key={h.label} style={styles.horizonItem}>
                <Text style={styles.horizonLabel}>{h.label}</Text>
                <Text style={[styles.horizonValue, { color: getCongestionColor(h.value) }]}>
                  {(h.value * 100).toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Row 5 — chips */}
          <View style={styles.chipRow}>
            <View style={[styles.chip, { backgroundColor: COLORS.ACCENT_DIM }]}>
              <Text style={styles.chipText}>⚡ {formatLatency(prediction.latency_ms)}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: '#1a1a1a' }]}>
              <Text style={styles.chipText}>± {prediction.uncertainty_t5.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

export default CongestionCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.LG,
    overflow: 'hidden',
  },
  border: {
    borderWidth: 1.5,
    borderRadius: RADIUS.LG,
    padding: SPACING.MD,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  cityName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
  },
  mainScore: {
    fontSize: 44,
    fontWeight: '800',
    lineHeight: 50,
  },
  subLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    marginBottom: SPACING.MD,
  },
  horizonGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.MD,
  },
  horizonItem: {
    flex: 1,
    alignItems: 'center',
  },
  horizonLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    marginBottom: 2,
  },
  horizonValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.CARD_BORDER,
    marginBottom: SPACING.SM,
  },
  chipRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  chip: {
    paddingHorizontal: SPACING.SM + 2,
    paddingVertical: SPACING.XS,
    borderRadius: RADIUS.SM,
  },
  chipText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: '600',
  },
  selectedGlow: {
    shadowColor: COLORS.ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
