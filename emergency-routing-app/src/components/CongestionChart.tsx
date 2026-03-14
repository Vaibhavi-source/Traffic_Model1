import React from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import type { PredictionResponse } from '@/types';
import { getCongestionColor } from '@/utils/congestion.utils';
import { COLORS, SPACING, RADIUS } from '@/config/theme';

interface CongestionChartProps {
  prediction: PredictionResponse;
}

export function CongestionChart({ prediction }: CongestionChartProps): React.JSX.Element {
  const chartColor = getCongestionColor(prediction.congestion_t5);
  const screenWidth = Dimensions.get('window').width - 48;

  const congestionData = [
    prediction.congestion_t5,
    prediction.congestion_t10,
    prediction.congestion_t20,
    prediction.congestion_t30,
  ];

  const upperBound = congestionData.map((val, idx) => {
    const uncertainties = [
      prediction.uncertainty_t5,
      prediction.uncertainty_t10,
      prediction.uncertainty_t20,
      prediction.uncertainty_t30,
    ];
    return Math.min(val + uncertainties[idx], 1);
  });

  const data = {
    labels: ['T+5', 'T+10', 'T+20', 'T+30'],
    datasets: [
      {
        data: congestionData,
        color: (_opacity: number = 1) => chartColor,
        strokeWidth: 2,
      },
      {
        data: upperBound,
        color: (_opacity: number = 1) => chartColor + '66',
        strokeWidth: 1,
        strokeDasharray: [5, 5],
      },
    ],
  };

  const chartConfig = {
    backgroundColor: COLORS.CARD_BG,
    backgroundGradientFrom: COLORS.CARD_BG,
    backgroundGradientTo: COLORS.BACKGROUND,
    color: (_opacity: number = 1) => chartColor,
    labelColor: () => COLORS.TEXT_SECONDARY,
    strokeWidth: 2,
    propsForDots: {
      r: '4',
    },
    decimalPlaces: 2,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Congestion Forecast</Text>
      <LineChart
        data={data}
        width={screenWidth}
        height={180}
        chartConfig={chartConfig}
        bezier
        withShadow={false}
        style={styles.chart}
      />
    </View>
  );
}

export default CongestionChart;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.MD,
    marginTop: SPACING.SM,
  },
  title: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    marginBottom: SPACING.SM,
    paddingLeft: SPACING.XS,
  },
  chart: {
    borderRadius: RADIUS.MD,
  },
});
