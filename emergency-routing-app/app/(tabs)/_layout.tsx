import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/config/theme';
import { useAppStore } from '@/store/appStore';

export default function TabLayout(): React.JSX.Element {
  const dispatchLogLength = useAppStore((s) => s.dispatchLog.length);
  const predictionsCount = useAppStore((s) => Object.keys(s.predictions).length);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.TAB_BG,
          borderTopColor: COLORS.TAB_BORDER,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: COLORS.ACCENT,
        tabBarInactiveTintColor: COLORS.TEXT_SECONDARY,
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarBadge: predictionsCount > 0 ? predictionsCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.ACCENT },
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dispatch"
        options={{
          title: 'Dispatch',
          tabBarBadge: dispatchLogLength > 0 ? dispatchLogLength : undefined,
          tabBarBadgeStyle: {
            backgroundColor: COLORS.DANGER,
          },
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="radio" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
