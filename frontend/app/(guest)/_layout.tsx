import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../src/constants/theme';

export default function GuestLayout() {
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: Colors.surface, shadowColor: 'transparent', elevation: 0 },
      headerTitle: () => (
        <View style={styles.headerRow}>
          <Text style={styles.brand}>
            <Text style={{ color: '#0A4F7F' }}>Property</Text>
            <Text style={{ color: '#DDA239' }}> Pulse</Text>
            <Text style={{ color: '#0A4F7F' }}> AI</Text>
          </Text>
          <View style={styles.guestBadge}><Text style={styles.guestBadgeText}>GUEST</Text></View>
        </View>
      ),
      tabBarActiveTintColor: Colors.primary,
      tabBarInactiveTintColor: Colors.grayInactive,
      tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
    }}>
      <Tabs.Screen name="welcome" options={{
        title: 'Welcome',
        tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
      }} />
      <Tabs.Screen name="guide" options={{
        title: 'Guide',
        tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} />,
      }} />
      <Tabs.Screen name="explore" options={{
        title: 'Explore',
        tabBarIcon: ({ color, size }) => <Ionicons name="compass" size={size} color={color} />,
      }} />
      <Tabs.Screen name="help" options={{
        title: 'Help',
        tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses" size={size} color={color} />,
      }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontSize: 18, fontWeight: '800' },
  guestBadge: { backgroundColor: Colors.greenReady, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  guestBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 1 },
});
