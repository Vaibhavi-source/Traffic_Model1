import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '@/config/theme';
import { useAppStore } from '@/store/appStore';
import { checkHealth, predictCity, getModelInfo } from '@/services/model1.service';
import type { CityConfig } from '@/types';

import { CitySelector } from '@/components/CitySelector';
import { MapplsMap } from '@/components/MapplsMap';
import { AlertBanner } from '@/components/AlertBanner';
import { CongestionCard } from '@/components/CongestionCard';
import { CongestionChart } from '@/components/CongestionChart';
import { LoadingOverlay } from '@/components/LoadingOverlay';

export default function MapScreen(): React.JSX.Element {
  const selectedCity = useAppStore((s) => s.selectedCity);
  const predictions = useAppStore((s) => s.predictions);
  const health = useAppStore((s) => s.health);
  const isLoading = useAppStore((s) => s.isLoading);
  const autoRefresh = useAppStore((s) => s.autoRefresh);
  const lastUpdated = useAppStore((s) => s.lastUpdated);
  const error = useAppStore((s) => s.error);

  const setSelectedCity = useAppStore((s) => s.setSelectedCity);
  const setPrediction = useAppStore((s) => s.setPrediction);
  const setHealth = useAppStore((s) => s.setHealth);
  const setModelInfo = useAppStore((s) => s.setModelInfo);
  const setLoading = useAppStore((s) => s.setLoading);
  const setError = useAppStore((s) => s.setError);
  const setAutoRefresh = useAppStore((s) => s.setAutoRefresh);

  const [countdown, setCountdown] = useState(30);
  const [localLastUpdated, setLocalLastUpdated] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const prediction = selectedCity ? predictions[selectedCity.name] : undefined;
  const alertScore = prediction ? prediction.congestion_t5 : null;

  const handlePredict = useCallback(
    async (cityName: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const result = await predictCity(cityName);
        setPrediction(cityName, result);
        setLocalLastUpdated(new Date().toLocaleTimeString());
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Prediction failed';
        setError(msg);
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => setError(null), 4000);
      } finally {
        setLoading(false);
      }
    },
    [setPrediction, setLoading, setError],
  );

  const handleCitySelect = useCallback(
    (city: CityConfig): void => {
      setSelectedCity(city);
      handlePredict(city.name);
    },
    [setSelectedCity, handlePredict],
  );

  // Mount: health + model info
  useEffect(() => {
    const fetchInitial = async (): Promise<void> => {
      try {
        const h = await checkHealth();
        setHealth(h);
      } catch {
        /* health check failure is non-fatal */
      }
      try {
        const mi = await getModelInfo();
        setModelInfo(mi);
      } catch {
        /* model info failure is non-fatal */
      }
    };
    fetchInitial();

    healthIntervalRef.current = setInterval(async () => {
      try {
        const h = await checkHealth();
        setHealth(h);
      } catch {
        /* silent */
      }
    }, 60000);

    return () => {
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [setHealth, setModelInfo]);

  // Auto-refresh countdown
  useEffect(() => {
    if (!autoRefresh || !selectedCity) {
      setCountdown(30);
      return () => {};
    }
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handlePredict(selectedCity.name);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedCity, handlePredict]);

  const isOnline = health?.status === 'ok' || health?.model_loaded === true;
  const defaultCity = { name: 'Delhi', lat: 28.6139, lng: 77.2090 };
  const displayCity = selectedCity ?? defaultCity;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LoadingOverlay />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🚨 Emergency Routing</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? COLORS.SUCCESS : COLORS.DANGER },
              ]}
            />
            <Text style={styles.statusText}>
              {isOnline ? '● AI Active' : '● Offline'}
            </Text>
          </View>
        </View>

        {/* Alert Banner */}
        <AlertBanner score={alertScore} />

        {/* City selector */}
        <CitySelector onCitySelect={handleCitySelect} />

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠ {error}</Text>
          </View>
        )}

        {/* Map */}
        <MapplsMap
          cityLat={displayCity.lat}
          cityLng={displayCity.lng}
          congestionScore={prediction?.congestion_t5 ?? 0}
          cityName={displayCity.name}
          isPulsing={autoRefresh && isLoading}
        />

        {/* Controls row */}
        <View style={styles.controlsRow}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Auto 30s</Text>
            <Switch
              value={autoRefresh}
              onValueChange={setAutoRefresh}
              trackColor={{ true: COLORS.ACCENT, false: '#333' }}
              thumbColor={COLORS.TEXT_PRIMARY}
            />
          </View>

          {autoRefresh && selectedCity && (
            <Text style={styles.countdownText}>
              Next update in {countdown}s
            </Text>
          )}

          <TouchableOpacity
            style={[
              styles.refreshButton,
              isLoading && styles.refreshButtonDisabled,
            ]}
            onPress={() => selectedCity && handlePredict(selectedCity.name)}
            disabled={isLoading || !selectedCity}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.ACCENT} />
            ) : (
              <Text style={styles.refreshText}>↻ Refresh Now</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Prediction data */}
        {prediction ? (
          <View style={styles.predictionSection}>
            <View style={styles.cardWrapper}>
              <CongestionCard prediction={prediction} isSelected />
            </View>
            <CongestionChart prediction={prediction} />
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Select a city above to run AI prediction
            </Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Last updated: {localLastUpdated ?? lastUpdated ?? '—'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.XL,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
  },
  headerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
  },
  errorBanner: {
    backgroundColor: '#2e0a0a',
    marginHorizontal: SPACING.MD,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderRadius: RADIUS.SM,
    borderWidth: 1,
    borderColor: COLORS.DANGER,
  },
  errorText: {
    color: COLORS.DANGER,
    fontSize: 13,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    flexWrap: 'wrap',
    gap: SPACING.SM,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
  },
  toggleLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
  },
  countdownText: {
    color: COLORS.ACCENT,
    fontSize: 12,
    fontWeight: '600',
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: COLORS.ACCENT,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM - 2,
    borderRadius: RADIUS.SM,
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
  refreshText: {
    color: COLORS.ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },
  predictionSection: {
    gap: SPACING.MD,
  },
  cardWrapper: {
    paddingHorizontal: SPACING.MD,
  },
  placeholder: {
    marginHorizontal: SPACING.MD,
    marginTop: SPACING.LG,
    paddingVertical: SPACING.XL,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: RADIUS.LG,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    textAlign: 'center',
    marginTop: SPACING.LG,
  },
});
