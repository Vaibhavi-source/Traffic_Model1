import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '@/config/theme';
import { useAppStore } from '@/store/appStore';
import { predictBatch } from '@/services/model1.service';
import { getCongestionColor } from '@/utils/congestion.utils';
import { CongestionCard } from '@/components/CongestionCard';
import { CITIES } from '@/components/CitySelector';

export default function DashboardScreen(): React.JSX.Element {
  const predictions = useAppStore((s) => s.predictions);
  const modelInfo = useAppStore((s) => s.modelInfo);
  const isLoading = useAppStore((s) => s.isLoading);
  const setBatchPredictions = useAppStore((s) => s.setBatchPredictions);
  const setLoading = useAppStore((s) => s.setLoading);
  const setError = useAppStore((s) => s.setError);

  const handlePredictAll = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const cityNames = CITIES.map((c) => c.name);
      const results = await predictBatch(cityNames);
      setBatchPredictions(results);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch prediction failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [setBatchPredictions, setLoading, setError]);

  const predictionEntries = CITIES.filter((c) => predictions[c.name]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <Text style={styles.header}>City Dashboard</Text>

        {/* Predict All Button */}
        <TouchableOpacity
          onPress={handlePredictAll}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#1a3aff', '#0000cc'] as [string, string]}
            style={styles.predictAllBtn}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.predictAllText}>⚡ Predict All Cities</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Summary strip */}
        {predictionEntries.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.summaryStrip}
          >
            {CITIES.map((city) => {
              const pred = predictions[city.name];
              const color = pred ? getCongestionColor(pred.congestion_t5) : '#333';
              return (
                <View key={city.name} style={[styles.miniCard, { borderColor: color }]}>
                  <View style={[styles.miniDot, { backgroundColor: color }]} />
                  <Text style={styles.miniCity}>{city.name.slice(0, 3).toUpperCase()}</Text>
                  {pred && (
                    <Text style={[styles.miniScore, { color }]}>
                      {(pred.congestion_t5 * 100).toFixed(0)}%
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* City Cards */}
        {predictionEntries.length > 0 ? (
          <View style={styles.cardList}>
            {predictionEntries.map((city) => (
              <CongestionCard
                key={city.name}
                prediction={predictions[city.name]}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="flash-outline" size={48} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.emptyText}>No predictions yet</Text>
            <Text style={styles.emptySubtext}>
              Tap "Predict All Cities" to fetch data
            </Text>
          </View>
        )}

        {/* Model Architecture */}
        {modelInfo && (
          <View style={styles.infoCard}>
            <Text style={styles.infoHeader}>🧠 Model Architecture</Text>
            {[
              ['Model', modelInfo.model_name],
              ['Parameters', modelInfo.parameter_count.toLocaleString()],
              ['LSTM Hidden', String(modelInfo.lstm_hidden_size)],
              ['GCN Hidden', String(modelInfo.gcn_hidden_dim)],
              ['Horizons', String(modelInfo.num_prediction_horizons)],
            ].map(([label, value]) => (
              <View key={label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Route Reliability Stub */}
        <View style={[styles.infoCard, { opacity: 0.4 }]}>
          <View style={styles.lockedRow}>
            <Ionicons name="lock-closed" size={16} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.lockedHeader}>🔒 Route Reliability Scoring</Text>
          </View>
          <Text style={styles.lockedText}>Model 2 — Coming Soon</Text>
        </View>
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
  content: {
    padding: SPACING.MD,
    paddingBottom: SPACING.XL,
    gap: SPACING.MD,
  },
  header: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '700',
  },
  predictAllBtn: {
    height: 48,
    borderRadius: RADIUS.MD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  predictAllText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryStrip: {
    gap: SPACING.SM,
    paddingVertical: SPACING.XS,
  },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
    paddingHorizontal: SPACING.SM + 2,
    paddingVertical: SPACING.SM,
    borderRadius: RADIUS.SM,
    borderWidth: 1,
    backgroundColor: COLORS.CARD_BG,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  miniCity: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: '700',
  },
  miniScore: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardList: {
    gap: SPACING.MD,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.XL * 2,
    gap: SPACING.SM,
  },
  emptyText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
  },
  infoCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: RADIUS.LG,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    padding: SPACING.MD,
    gap: SPACING.SM,
  },
  infoHeader: {
    color: COLORS.ACCENT,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: SPACING.XS,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
  },
  infoValue: {
    color: COLORS.ACCENT,
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
  },
  lockedHeader: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '600',
  },
  lockedText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontStyle: 'italic',
  },
});
