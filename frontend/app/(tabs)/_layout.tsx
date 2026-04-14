import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function TabLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user]);

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
        headerTitle: 'Property Pulse',
        tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
      }} />
      <Tabs.Screen name="turnovers" options={{
        title: 'Turnovers',
        tabBarIcon: ({ color, size }) => <Ionicons name="refresh-circle" size={size} color={color} />,
      }} />
      <Tabs.Screen name="maintenance" options={{
        title: 'Maintenance',
        tabBarIcon: ({ color, size }) => <Ionicons name="construct" size={size} color={color} />,
      }} />
      <Tabs.Screen name="marketplace" options={{
        title: 'Marketplace',
        tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} />,
      }} />
      <Tabs.Screen name="more" options={{
        title: 'More',
        tabBarIcon: ({ color, size }) => <Ionicons name="menu" size={size} color={color} />,
      }} />
    </Tabs>
  );
}
