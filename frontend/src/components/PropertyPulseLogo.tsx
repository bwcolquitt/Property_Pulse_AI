import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';

interface LogoProps {
  size?: number;
  showTagline?: boolean;
}

export default function PropertyPulseLogo({ size = 48, showTagline = false }: LogoProps) {
  const NAVY = '#0A4F7F';
  const GOLD = '#DDA239';
  const SLATE = '#7AA3B9';

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <Svg width={size} height={size} viewBox="0 0 64 64">
          {/* House shape - clean geometric */}
          <Path
            d="M32 8 L56 28 L56 56 L8 56 L8 28 Z"
            fill="none"
            stroke={NAVY}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Roof peak accent */}
          <Path
            d="M32 8 L56 28"
            fill="none"
            stroke={GOLD}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Path
            d="M32 8 L8 28"
            fill="none"
            stroke={NAVY}
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Pulse/heartbeat line through the house */}
          <Path
            d="M4 38 L18 38 L23 28 L28 48 L33 22 L38 44 L43 34 L48 38 L60 38"
            fill="none"
            stroke={GOLD}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Door */}
          <Rect
            x="26"
            y="42"
            width="12"
            height="14"
            rx="2"
            fill={SLATE}
            opacity={0.3}
          />
          {/* Window left */}
          <Rect
            x="14"
            y="34"
            width="8"
            height="8"
            rx="1"
            fill={SLATE}
            opacity={0.2}
          />
          {/* Window right */}
          <Rect
            x="42"
            y="34"
            width="8"
            height="8"
            rx="1"
            fill={SLATE}
            opacity={0.2}
          />
          {/* Small dot on door - handle */}
          <Circle cx="35" cy="50" r="1.5" fill={NAVY} />
        </Svg>
        <View style={styles.textCol}>
          <Text style={[styles.brandName, { fontSize: size * 0.42 }]}>
            <Text style={{ color: NAVY }}>Property</Text>
            <Text style={{ color: GOLD }}> Pulse</Text>
          </Text>
          {showTagline && (
            <Text style={[styles.tagline, { fontSize: size * 0.2 }]}>
              The operating system for short-term rental readiness
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textCol: { gap: 2 },
  brandName: { fontWeight: '800', letterSpacing: -0.5 },
  tagline: { color: '#64748B', fontWeight: '500', maxWidth: 220 },
});
