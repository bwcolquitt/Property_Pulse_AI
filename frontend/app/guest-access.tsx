import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import api from '../src/utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function GuestAccessScreen() {
  const { token } = useLocalSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!token) { setError('No access token provided'); setLoading(false); return; }
      try {
        const { data } = await api.post('/guest-portal/access', { token });
        // Store token and set user
        await AsyncStorage.setItem('auth_token', data.token);
        // Force reload to trigger auth guard
        router.replace('/(guest)/welcome');
      } catch (e: any) {
        setError(e.response?.data?.detail || 'Invalid or expired link');
      }
      finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Setting up your stay...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle" size={56} color={Colors.redUrgent} />
        <Text style={styles.errorTitle}>Access Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace('/')}>
          <Text style={styles.retryText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: Spacing.md, padding: Spacing.lg },
  loadingText: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  errorTitle: { fontSize: 22, fontWeight: '800', color: Colors.redUrgent },
  errorText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary },
  retryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
