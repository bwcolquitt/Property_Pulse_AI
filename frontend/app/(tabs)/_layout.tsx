import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useState, useEffect } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import api from '../../src/utils/api';

function HeaderLogo() {
  const router = useRouter();
  const { isDemo } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/notifications/count');
        setUnread(data.unread_count || 0);
      } catch {}
    })();
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get('/notifications/count');
        setUnread(data.unread_count || 0);
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={hStyles.container}>
      <View style={hStyles.row}>
        <Svg width={28} height={28} viewBox="0 0 64 64">
          <Path d="M32 8 L56 28 L56 56 L8 56 L8 28 Z" fill="none" stroke="#0A4F7F" strokeWidth="3.5" strokeLinejoin="round" />
          <Path d="M32 8 L56 28" fill="none" stroke="#DDA239" strokeWidth="3.5" strokeLinecap="round" />
          <Path d="M32 8 L8 28" fill="none" stroke="#0A4F7F" strokeWidth="3.5" strokeLinecap="round" />
          <Path d="M4 38 L18 38 L23 28 L28 48 L33 22 L38 44 L43 34 L48 38 L60 38" fill="none" stroke="#DDA239" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="26" y="42" width="12" height="14" rx="2" fill="#7AA3B9" opacity={0.3} />
          <Circle cx="35" cy="50" r="1.5" fill="#0A4F7F" />
        </Svg>
        <Text style={hStyles.brand}>
          <Text style={{ color: '#0A4F7F' }}>Property</Text>
          <Text style={{ color: '#DDA239' }}> Pulse</Text>
          <Text style={{ color: '#0A4F7F' }}> AI</Text>
        </Text>
        {isDemo && <View style={hStyles.demoBadge}><Text style={hStyles.demoText}>DEMO</Text></View>}
      </View>
      <TouchableOpacity testID="notifications-bell" style={hStyles.bellBtn} onPress={() => router.push('/notifications' as any)}>
        <Ionicons name="notifications-outline" size={24} color={Colors.primary} />
        {unread > 0 && (
          <View style={hStyles.badge}>
            <Text style={hStyles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const hStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  bellBtn: { position: 'relative', padding: 4 },
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#EF4444', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  demoBadge: { backgroundColor: '#DDA239', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
  demoText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 1 },
});

export default function TabLayout() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: Colors.surface },
      headerTintColor: Colors.textPrimary,
      headerTitleStyle: { fontWeight: '700' },
      tabBarActiveTintColor: Colors.primary,
      tabBarInactiveTintColor: Colors.grayInactive,
      tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border, height: 60, paddingBottom: 8, paddingTop: 4 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Dashboard',
        headerTitle: () => <HeaderLogo />,
        tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
      }} />
      <Tabs.Screen name="turnovers" options={{
        title: 'Turnovers',
        headerTitle: 'Turnovers',
        tabBarIcon: ({ color, size }) => <Ionicons name="refresh-circle" size={size} color={color} />,
      }} />
      <Tabs.Screen name="maintenance" options={{
        title: 'Maintenance',
        headerTitle: 'Maintenance',
        tabBarIcon: ({ color, size }) => <Ionicons name="construct" size={size} color={color} />,
      }} />
      <Tabs.Screen name="marketplace" options={{
        title: 'Marketplace',
        headerTitle: 'Marketplace',
        tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} />,
      }} />
      <Tabs.Screen name="more" options={{
        title: 'More',
        headerTitle: 'More',
        tabBarIcon: ({ color, size }) => <Ionicons name="menu" size={size} color={color} />,
      }} />
    </Tabs>
  );
}
