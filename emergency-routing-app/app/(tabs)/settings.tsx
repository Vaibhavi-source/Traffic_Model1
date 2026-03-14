import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '@/config/theme';
import { API_BASE_URL } from '@/config/api.config';
import { useAppStore } from '@/store/appStore';
import { checkHealth } from '@/services/model1.service';
import { formatUptime, formatLatency } from '@/utils/congestion.utils';

export default function SettingsScreen(): React.JSX.Element {
  const health = useAppStore((s) => s.health);
  const modelInfo = useAppStore((s) => s.modelInfo);
  const predictions = useAppStore((s) => s.predictions);
  const setHealth = useAppStore((s) => s.setHealth);
  const clearPredictions = useAppStore((s) => s.clearPredictions);
  const clearDispatchLog = useAppStore((s) => s.clearDispatchLog);

  const handleRefreshHealth = useCallback(async (): Promise<void> => {
    try {
      const h = await checkHealth();
      setHealth(h);
    } catch {
      /* silent */
    }
  }, [setHealth]);

  const isOnline = health?.status === 'ok' || health?.model_loaded === true;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* API Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔌 API Configuration</Text>
          <Text style={styles.label}>Backend URL</Text>
          <TextInput
            style={styles.urlInput}
            value={API_BASE_URL}
            editable={false}
            selectTextOnFocus
          />
          <Text style={styles.helperText}>
            Edit src/config/api.config.ts to change
          </Text>
        </View>

        {/* Model Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🟢 Model Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.label}>Status</Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: isOnline ? COLORS.SUCCESS : COLORS.DANGER },
              ]}
            >
              <Text style={styles.statusPillText}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.label}>Model Loaded</Text>
            <Text
              style={[
                styles.value,
                { color: health?.model_loaded ? COLORS.SUCCESS : COLORS.DANGER },
              ]}
            >
              {health?.model_loaded ? '✓ Loaded' : '✗ Not loaded'}
            </Text>
          </View>

          {health?.cities_available && (
            <View style={styles.statusRow}>
              <Text style={styles.label}>Cities</Text>
              <Text style={styles.value}>
                {health.cities_available.join(', ')}
              </Text>
            </View>
          )}

          {health?.uptime_seconds !== undefined && (
            <View style={styles.statusRow}>
              <Text style={styles.label}>Uptime</Text>
              <Text style={styles.value}>
                {formatUptime(health.uptime_seconds)}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.smallButton}
            onPress={handleRefreshHealth}
            activeOpacity={0.7}
          >
            <Text style={styles.smallButtonText}>Refresh Status</Text>
          </TouchableOpacity>
        </View>

        {/* Model Architecture */}
        {modelInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧠 Model Architecture</Text>
            {[
              ['Model Name', modelInfo.model_name],
              ['Parameters', modelInfo.parameter_count.toLocaleString()],
              ['LSTM Hidden', String(modelInfo.lstm_hidden_size)],
              ['GCN Hidden', String(modelInfo.gcn_hidden_dim)],
              ['Horizons', String(modelInfo.num_prediction_horizons)],
              ['Checkpoint', modelInfo.checkpoint_path],
            ].map(([label, val]) => (
              <View key={label} style={styles.statusRow}>
                <Text style={styles.label}>{label}</Text>
                <Text style={[styles.value, styles.monoValue]}>{val}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏱ Performance</Text>
          {Object.values(predictions).length > 0 ? (
            Object.entries(predictions).map(([city, pred]) => (
              <View key={city} style={styles.statusRow}>
                <Text style={styles.label}>{city} latency</Text>
                <Text style={[styles.value, styles.monoValue]}>
                  {formatLatency(pred.latency_ms)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.helperText}>No predictions yet</Text>
          )}
        </View>

        {/* Coming Soon */}
        <View style={[styles.section, { opacity: 0.4 }]}>
          <Text style={styles.sectionTitle}>🔒 Coming Soon</Text>
          <View style={styles.lockedItem}>
            <Ionicons name="lock-closed" size={14} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.lockedText}>
              Model 2 — Route Reliability Scorer
            </Text>
          </View>
          <View style={styles.lockedItem}>
            <Ionicons name="lock-closed" size={14} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.lockedText}>
              Model 3 — RL Rerouting Agent (DQN)
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Actions</Text>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={clearPredictions}
            activeOpacity={0.7}
          >
            <Text style={styles.dangerButtonText}>Clear All Predictions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={clearDispatchLog}
            activeOpacity={0.7}
          >
            <Text style={styles.dangerButtonText}>Clear Dispatch Log</Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <Text style={styles.versionText}>
          v1.0.0-demo  |  Model 1 Active
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
  content: {
    padding: SPACING.MD,
    paddingBottom: SPACING.XL,
    gap: SPACING.LG,
  },
  section: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: RADIUS.LG,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    padding: SPACING.MD,
    gap: SPACING.SM,
  },
  sectionTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.XS,
  },
  label: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
  },
  value: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
  },
  monoValue: {
    fontFamily: 'monospace',
    color: COLORS.ACCENT,
  },
  urlInput: {
    backgroundColor: COLORS.BACKGROUND,
    color: COLORS.TEXT_PRIMARY,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    borderRadius: RADIUS.SM,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  helperText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    opacity: 0.7,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: SPACING.SM + 2,
    paddingVertical: 2,
    borderRadius: RADIUS.PILL,
  },
  statusPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  smallButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM - 2,
    borderRadius: RADIUS.SM,
    borderWidth: 1,
    borderColor: COLORS.ACCENT,
    marginTop: SPACING.XS,
  },
  smallButtonText: {
    color: COLORS.ACCENT,
    fontSize: 12,
    fontWeight: '600',
  },
  lockedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
  },
  lockedText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: COLORS.DANGER,
    borderRadius: RADIUS.SM,
    paddingVertical: SPACING.SM,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: COLORS.DANGER,
    fontSize: 13,
    fontWeight: '600',
  },
  versionText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.5,
  },
});
