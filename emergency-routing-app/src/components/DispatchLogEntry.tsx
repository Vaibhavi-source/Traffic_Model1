import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { DispatchLogEntry as LogEntry } from '@/types';
import { getCongestionColor, getCongestionLabel } from '@/utils/congestion.utils';
import { COLORS, SPACING, RADIUS } from '@/config/theme';

interface DispatchLogEntryProps {
  entry: LogEntry;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function DispatchLogEntry({ entry }: DispatchLogEntryProps): React.JSX.Element {
  const color = getCongestionColor(entry.score);
  const label = getCongestionLabel(entry.score);

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.headerRow}>
        <Text style={styles.city}>{entry.city}</Text>
        <Text style={styles.timestamp}>{formatTime(entry.timestamp)}</Text>
      </View>
      <Text style={styles.message} numberOfLines={2}>{entry.message}</Text>
      <View style={styles.chipRow}>
        <View style={[styles.chip, { backgroundColor: color }]}>
          <Text style={styles.chipText}>{(entry.score * 100).toFixed(0)}%</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: color + '33' }]}>
          <Text style={[styles.chipText, { color }]}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

export default DispatchLogEntry;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: RADIUS.MD,
    borderLeftWidth: 3,
    padding: SPACING.MD - 4,
    marginBottom: SPACING.SM,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.XS,
  },
  city: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '700',
  },
  timestamp: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
  },
  message: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    marginBottom: SPACING.SM,
  },
  chipRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  chip: {
    paddingHorizontal: SPACING.SM,
    paddingVertical: 2,
    borderRadius: RADIUS.PILL,
  },
  chipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
