import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../src/constants/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.primary,
        headerTitleStyle: { fontWeight: '700', color: Colors.textPrimary },
        headerBackTitle: 'Back',
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="turnover/[id]" options={{ headerShown: true, title: 'Turnover Detail' }} />
        <Stack.Screen name="issue/[id]" options={{ headerShown: true, title: 'Issue Detail' }} />
        <Stack.Screen name="checklist/[id]" options={{ headerShown: true, title: 'Checklist' }} />
        <Stack.Screen name="property/[id]" options={{ headerShown: true, title: 'Property' }} />
        <Stack.Screen name="property/list" options={{ headerShown: true, title: 'Properties' }} />
        <Stack.Screen name="messages" options={{ headerShown: true, title: 'Messages' }} />
        <Stack.Screen name="reports" options={{ headerShown: true, title: 'Reports' }} />
        <Stack.Screen name="team" options={{ headerShown: true, title: 'Team' }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
        <Stack.Screen name="inspections" options={{ headerShown: true, title: 'Inspections' }} />
        <Stack.Screen name="inventory" options={{ headerShown: true, title: 'Inventory' }} />
        <Stack.Screen name="calendar" options={{ headerShown: true, title: 'Calendar' }} />
      </Stack>
    </AuthProvider>
  );
}
