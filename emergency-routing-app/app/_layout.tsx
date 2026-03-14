import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { COLORS } from '@/config/theme';

export default function RootLayout(): React.JSX.Element {
  return (
    <>
      <StatusBar style="light" backgroundColor={COLORS.BACKGROUND} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.BACKGROUND },
          animation: 'fade',
        }}
      />
    </>
  );
}
