/**
 * Push Notifications helper - registers Expo push token with backend.
 *
 * Called on login (or app mount when authenticated). Safely no-ops on web.
 */
import { Platform } from 'react-native';
import api from './api';

let registered = false;

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null; // Expo Notifications unsupported on web
  if (registered) return null;
  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');

    if (!Device.isDevice) return null;

    // Permissions
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    // Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData?.data;
    if (!token) return null;

    // Register with backend
    await api.post('/push/register', {
      token,
      platform: Platform.OS,
      device_name: Device.deviceName || '',
    });
    registered = true;
    return token;
  } catch (e) {
    console.warn('[push] register failed:', e);
    return null;
  }
}
