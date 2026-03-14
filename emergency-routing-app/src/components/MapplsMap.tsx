import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated as RNAnimated } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS, RADIUS, SPACING } from '@/config/theme';

interface MapplsMapProps {
  cityLat: number;
  cityLng: number;
  congestionScore: number;
  cityName: string;
  isPulsing: boolean;
}

const MAPPLS_KEY = process.env.EXPO_PUBLIC_MAPPLS_API_KEY ?? '';

function buildMapHtml(
  lat: number,
  lng: number,
  score: number,
  cityName: string,
): string {
  const color =
    score < 0.3 ? '#00C851' : score < 0.6 ? '#FF8800' : '#FF4444';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; }
    body { background: #0a0a0f; }
    #map { width: 100vw; height: 100vh; }
  </style>
  <script src="https://apis.mappls.com/advancedmaps/api/${MAPPLS_KEY}/map_sdk?layer=vector&v=3.0&callback=initMap" defer async></script>
  <script>
    function initMap() {
      var map = new mappls.Map('map', {
        center: [${lat}, ${lng}],
        zoom: 12,
        zoomControl: true,
      });

      map.on('load', function() {
        new mappls.Circle({
          map: map,
          center: { lat: ${lat}, lng: ${lng} },
          radius: 3000,
          fillColor: '${color}',
          fillOpacity: 0.35,
          strokeColor: '${color}',
          strokeOpacity: 0.8,
          strokeWeight: 2,
        });

        var marker = new mappls.Marker({
          map: map,
          position: { lat: ${lat}, lng: ${lng} },
          popupHtml: '<b>${cityName}</b><br>Congestion: ${(score * 100).toFixed(1)}%',
          popupOptions: { openPopup: true },
        });
      });
    }
  </script>
</head>
<body>
  <div id="map"></div>
</body>
</html>`;
}

export function MapplsMap({
  cityLat,
  cityLng,
  congestionScore,
  cityName,
  isPulsing,
}: MapplsMapProps): React.JSX.Element {
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    let animation: RNAnimated.CompositeAnimation | null = null;
    if (isPulsing) {
      animation = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 500,
            useNativeDriver: true,
          }),
          RNAnimated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [isPulsing, pulseAnim]);

  const html = buildMapHtml(cityLat, cityLng, congestionScore, cityName);

  return (
    <RNAnimated.View style={[styles.container, { opacity: pulseAnim }]}>
      <WebView
        key={`${cityName}-${congestionScore.toFixed(2)}`}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        renderError={() => (
          <View style={styles.fallback}>
            <Text style={styles.fallbackCity}>{cityName}</Text>
            <Text style={styles.fallbackText}>Map unavailable</Text>
            <Text style={styles.fallbackHint}>Add Mappls API key to .env</Text>
          </View>
        )}
      />
    </RNAnimated.View>
  );
}

export default MapplsMap;

const styles = StyleSheet.create({
  container: {
    height: 280,
    borderRadius: RADIUS.LG,
    overflow: 'hidden',
    marginHorizontal: SPACING.MD,
    marginVertical: SPACING.SM,
    backgroundColor: COLORS.CARD_BG,
  },
  webview: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  fallback: {
    flex: 1,
    backgroundColor: COLORS.CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LG,
  },
  fallbackCity: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: SPACING.SM,
  },
  fallbackText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  fallbackHint: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    marginTop: SPACING.XS,
    opacity: 0.6,
  },
});
