import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '@/config/theme';
import {
  getAlertLevel,
  getCongestionMessage,
  getCongestionColor,
} from '@/utils/congestion.utils';
import type { AlertLevel } from '@/types';

interface AlertBannerProps {
  score: number | null;
}

const ALERT_CONFIG: Record<AlertLevel, {
  bg: string;
  border: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = {
  clear: {
    bg: '#0a2e1a',
    border: '#00C851',
    icon: 'checkmark-circle',
  },
  moderate: {
    bg: '#2e1a00',
    border: '#FF8800',
    icon: 'warning',
  },
  high: {
    bg: '#2e0a0a',
    border: '#FF4444',
    icon: 'alert-circle',
  },
};

export function AlertBanner({ score }: AlertBannerProps): React.JSX.Element | null {
  if (score === null) return null;

  const alertLevel = getAlertLevel(score);
  const config = ALERT_CONFIG[alertLevel];
  const message = getCongestionMessage(score);
  const color = getCongestionColor(score);

  const translateY = useSharedValue(-60);
  const borderOpacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 15, stiffness: 100 });

    if (alertLevel === 'high') {
      borderOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 500 }),
          withTiming(1, { duration: 500 }),
        ),
        -1,
        true,
      );
    }

    return () => {
      translateY.value = -60;
      borderOpacity.value = 1;
    };
  }, [score, alertLevel, translateY, borderOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: config.border,
    borderWidth: 1.5,
    opacity: alertLevel === 'high' ? borderOpacity.value : 1,
  }));

  return (
    <Animated.View style={[styles.container, { backgroundColor: config.bg }, animatedStyle, borderStyle]}>
      <Ionicons name={config.icon} size={20} color={config.border} />
      <Text style={[styles.message, { color: COLORS.TEXT_PRIMARY }]} numberOfLines={2}>
        {message}
      </Text>
      <View style={[styles.scorePill, { backgroundColor: color }]}>
        <Text style={styles.scoreText}>{(score * 100).toFixed(0)}%</Text>
      </View>
    </Animated.View>
  );
}

export default AlertBanner;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.MD,
    marginVertical: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM + 2,
    borderRadius: RADIUS.MD,
    gap: SPACING.SM,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  scorePill: {
    paddingHorizontal: SPACING.SM,
    paddingVertical: 2,
    borderRadius: RADIUS.PILL,
  },
  scoreText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
