import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../src/constants/theme';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const firstSegment = segments[0];
    const isPublicPage = !firstSegment || firstSegment === 'index' || firstSegment === 'login' || firstSegment === 'register' || firstSegment === 'guest-book' || firstSegment === 'guest-access';
    const isGuestArea = firstSegment === '(guest)';
    const isTabsArea = firstSegment === '(tabs)';

    if (user && isPublicPage) {
      // Logged in but on landing/login/register - redirect based on role
      if (user.role === 'guest') {
        router.replace('/(guest)/welcome');
      } else {
        router.replace('/(tabs)');
      }
    } else if (user && user.role === 'guest' && isTabsArea) {
      // Guest user on admin tabs - redirect to guest area
      router.replace('/(guest)/welcome');
    } else if (user && user.role !== 'guest' && isGuestArea) {
      // Non-guest on guest area - redirect to admin tabs
      router.replace('/(tabs)');
    } else if (!user && !isPublicPage) {
      // Not logged in but on a protected page - redirect to login
      router.replace('/login');
    }
  }, [user, loading, segments]);

  return (
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
      <Stack.Screen name="(guest)" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="guest-access" options={{ headerShown: false }} />
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
      <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
      <Stack.Screen name="service-rates" options={{ headerShown: true, title: 'Service Rates' }} />
      <Stack.Screen name="property-services" options={{ headerShown: true, title: 'Property Services' }} />
      <Stack.Screen name="admin-review" options={{ headerShown: true, title: 'Review Queue' }} />
      <Stack.Screen name="ai-command" options={{ headerShown: true, title: 'AI Command Center' }} />
      <Stack.Screen name="recurring-schedules" options={{ headerShown: true, title: 'Recurring Schedules' }} />
      <Stack.Screen name="provider-calendar" options={{ headerShown: true, title: 'Provider Calendar' }} />
      <Stack.Screen name="job-board" options={{ headerShown: true, title: 'Job Board' }} />
      <Stack.Screen name="reservations" options={{ headerShown: true, title: 'Reservations' }} />
      <Stack.Screen name="assets" options={{ headerShown: true, title: 'Property Assets' }} />
      <Stack.Screen name="supply-requests" options={{ headerShown: true, title: 'Supply Requests' }} />
      <Stack.Screen name="guest-book" options={{ headerShown: false, title: 'Book a Stay' }} />
      <Stack.Screen name="payment-settings" options={{ headerShown: true, title: 'Payment Settings' }} />
      <Stack.Screen name="help-center" options={{ headerShown: true, title: 'Help Center' }} />
      <Stack.Screen name="ai-assistant" options={{ headerShown: true, title: 'AI Assistant' }} />
      <Stack.Screen name="company-config" options={{ headerShown: true, title: 'Company Settings' }} />
      <Stack.Screen name="onsite-purchases" options={{ headerShown: true, title: 'On-Site Purchases' }} />
      <Stack.Screen name="improvements" options={{ headerShown: true, title: 'Improvements' }} />
      <Stack.Screen name="property-notes" options={{ headerShown: true, title: 'Service Notes' }} />
      <Stack.Screen name="inspection-prep" options={{ headerShown: true, title: 'Inspection Prep' }} />
      <Stack.Screen name="host-inbox" options={{ headerShown: true, title: 'Host Inbox' }} />
      <Stack.Screen name="owners-inventory" options={{ headerShown: true, title: 'Owner Storage' }} />
      <Stack.Screen name="sms-config" options={{ headerShown: true, title: 'SMS Delivery' }} />
      <Stack.Screen name="pms-connect" options={{ headerShown: true, title: 'PMS Integrations' }} />
      <Stack.Screen name="send-guest-link" options={{ headerShown: true, title: 'Send Guest Access' }} />
      <Stack.Screen name="ical-feeds" options={{ headerShown: true, title: 'iCal Feeds' }} />
      <Stack.Screen name="email-config" options={{ headerShown: true, title: 'Email Delivery' }} />
      <Stack.Screen name="cleaner-scorecards" options={{ headerShown: true, title: 'Cleaner Scorecards' }} />
      <Stack.Screen name="hcp-config" options={{ headerShown: true, title: 'Housecall Pro' }} />
      <Stack.Screen name="setup-wizard" options={{ headerShown: true, title: 'Setup Wizard' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
