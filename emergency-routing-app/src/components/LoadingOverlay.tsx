import React, { useRef, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING } from '@/config/theme';
import { useAppStore } from '@/store/appStore';

export function LoadingOverlay(): React.JSX.Element | null {
  const isLoading = useAppStore((s) => s.isLoading);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    return () => {
      fadeAnim.stopAnimation();
    };
  }, [isLoading, fadeAnim]);

  if (!isLoading) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.text}>Running LSTM+GCN inference...</Text>
        <Text style={styles.subtext}>Model 1 — Spatiotemporal Prediction</Text>
      </View>
    </Animated.View>
  );
}

export default LoadingOverlay;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  content: {
    alignItems: 'center',
  },
  text: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    marginTop: SPACING.MD,
  },
  subtext: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    opacity: 0.6,
    marginTop: SPACING.XS,
  },
});
