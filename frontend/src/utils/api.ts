import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Token management
let authToken: string | null = null;

export const setToken = async (token: string | null) => {
  authToken = token;
  if (token) {
    if (Platform.OS === 'web') {
      try { localStorage.setItem('auth_token', token); } catch {}
    } else {
      await SecureStore.setItemAsync('auth_token', token);
    }
  } else {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem('auth_token'); } catch {}
    } else {
      await SecureStore.deleteItemAsync('auth_token');
    }
  }
};

export const getToken = async (): Promise<string | null> => {
  if (authToken) return authToken;
  if (Platform.OS === 'web') {
    try { authToken = localStorage.getItem('auth_token'); } catch {}
  } else {
    authToken = await SecureStore.getItemAsync('auth_token');
  }
  return authToken;
};

// Add auth header interceptor
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
