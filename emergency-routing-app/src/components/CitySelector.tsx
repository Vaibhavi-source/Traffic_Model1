import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { CityConfig, PredictionResponse } from '@/types';
import { getCongestionColor } from '@/utils/congestion.utils';
import { COLORS, SPACING, RADIUS } from '@/config/theme';
import { useAppStore } from '@/store/appStore';

interface CitySelectorProps {
  onCitySelect: (city: CityConfig) => void;
}

const CITIES: CityConfig[] = [
  { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Patna', lat: 25.5941, lng: 85.1376 },
];

export { CITIES };

export function CitySelector({ onCitySelect }: CitySelectorProps): React.JSX.Element {
  const selectedCity = useAppStore((s) => s.selectedCity);
  const predictions = useAppStore((s) => s.predictions);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {CITIES.map((city) => {
        const isSelected = selectedCity?.name === city.name;
        const prediction: PredictionResponse | undefined = predictions[city.name];
        const hasPrediction = prediction !== undefined;

        let bgColor = 'transparent';
        let borderColor = '#333333';
        if (isSelected && hasPrediction) {
          bgColor = getCongestionColor(prediction.congestion_t5);
          borderColor = bgColor;
        } else if (isSelected) {
          bgColor = COLORS.ACCENT;
          borderColor = COLORS.ACCENT;
        }

        return (
          <TouchableOpacity
            key={city.name}
            onPress={() => onCitySelect(city)}
            style={[
              styles.pill,
              {
                backgroundColor: bgColor,
                borderColor: borderColor,
              },
            ]}
            activeOpacity={0.7}
          >
            {hasPrediction && !isSelected && (
              <View
                style={[
                  styles.dot,
                  { backgroundColor: getCongestionColor(prediction.congestion_t5) },
                ]}
              />
            )}
            <Text
              style={[
                styles.pillText,
                isSelected && styles.pillTextSelected,
              ]}
            >
              {city.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default CitySelector;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    gap: SPACING.SM,
  },
  pill: {
    height: 40,
    paddingHorizontal: SPACING.MD,
    borderRadius: RADIUS.PILL,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  pillTextSelected: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '700',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SPACING.XS,
  },
});
