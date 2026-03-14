import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '@/config/theme';
import { useAppStore } from '@/store/appStore';
import { DispatchLogEntry } from '@/components/DispatchLogEntry';
import type { DispatchLogEntry as LogEntryType } from '@/types';

export default function DispatchScreen(): React.JSX.Element {
  const dispatchLog = useAppStore((s) => s.dispatchLog);
  const clearDispatchLog = useAppStore((s) => s.clearDispatchLog);

  const hasHighAlerts = dispatchLog.some((e) => e.congestionLevel === 'high');

  const handleClear = useCallback((): void => {
    Alert.alert(
      'Clear Dispatch Log',
      'This will remove all dispatch events. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => clearDispatchLog(),
        },
      ],
    );
  }, [clearDispatchLog]);

  const renderItem = useCallback(
    ({ item }: { item: LogEntryType }): React.JSX.Element => (
      <DispatchLogEntry entry={item} />
    ),
    [],
  );

  const keyExtractor = useCallback(
    (item: LogEntryType): string => item.id,
    [],
  );

  const Separator = useCallback(
    (): React.JSX.Element => <View style={styles.separator} />,
    [],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📡 Dispatch Log</Text>
        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: hasHighAlerts
                ? COLORS.DANGER
                : dispatchLog.length > 0
                  ? COLORS.WARNING
                  : COLORS.CARD_BG,
            },
          ]}
        >
          <Text style={styles.countText}>{dispatchLog.length}</Text>
        </View>
      </View>

      {dispatchLog.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="radio-outline" size={56} color={COLORS.TEXT_SECONDARY} />
          <Text style={styles.emptyText}>No dispatch events yet</Text>
          <Text style={styles.emptySubtext}>
            Predictions will appear here automatically
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={dispatchLog}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={Separator}
            contentContainerStyle={styles.listContent}
            ListFooterComponent={
              <Text style={styles.footerText}>
                {dispatchLog.length} total events
              </Text>
            }
          />

          <View style={styles.clearRow}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClear}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.DANGER} />
              <Text style={styles.clearText}>Clear Log</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
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
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.SM,
  },
  countText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: SPACING.MD,
    paddingBottom: SPACING.LG,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.CARD_BORDER,
    marginVertical: SPACING.XS,
  },
  footerText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    textAlign: 'center',
    marginTop: SPACING.MD,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.SM,
    paddingBottom: SPACING.XL * 2,
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
  clearRow: {
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    borderTopWidth: 1,
    borderTopColor: COLORS.CARD_BORDER,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.SM,
    paddingVertical: SPACING.SM + 2,
    borderWidth: 1,
    borderColor: COLORS.DANGER,
    borderRadius: RADIUS.SM,
  },
  clearText: {
    color: COLORS.DANGER,
    fontSize: 14,
    fontWeight: '600',
  },
});
