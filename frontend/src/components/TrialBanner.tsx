/**
 * TrialBanner - Dashboard top banner showing trial status / billing state.
 *
 * States:
 *   - Trial active: blue banner "14-day free trial · X days left · Upgrade"
 *   - Trial ending soon (<=3 days): amber banner
 *   - Past due: red banner
 *   - Cancelling: gray banner
 *   - Active/paid: hidden
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../constants/theme';
import api from '../utils/api';

interface TenantInfo {
  plan?: string;
  status?: string;
  trial_days_left?: number;
  is_in_trial?: boolean;
  name?: string;
}

export default function TrialBanner() {
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/tenants/me');
        setTenant(data);
      } catch {}
    })();
  }, []);

  if (!tenant) return null;

  const status = tenant.status || 'active';
  const daysLeft = tenant.trial_days_left ?? 14;

  // Trial active
  if (tenant.is_in_trial && status === 'trialing') {
    const urgent = daysLeft <= 3;
    const bg = urgent ? Colors.yellowAtRisk + '20' : Colors.primary + '12';
    const border = urgent ? Colors.yellowAtRisk : Colors.primary;
    const iconColor = urgent ? Colors.yellowAtRisk : Colors.primary;
    return (
      <TouchableOpacity testID="trial-banner" style={[styles.banner, { backgroundColor: bg, borderColor: border }]} onPress={() => router.push('/billing')}>
        <Ionicons name={urgent ? 'alert-circle' : 'gift'} size={20} color={iconColor} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: iconColor }]}>
            {urgent ? `Only ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left in trial` : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left in free trial`}
          </Text>
          <Text style={styles.subtitle}>Tap to view plans · Current: <Text style={styles.bold}>{(tenant.plan || 'pro').toUpperCase()}</Text></Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={iconColor} />
      </TouchableOpacity>
    );
  }

  if (status === 'past_due') {
    return (
      <TouchableOpacity style={[styles.banner, { backgroundColor: Colors.redUrgent + '15', borderColor: Colors.redUrgent }]} onPress={() => router.push('/billing')}>
        <Ionicons name="alert-circle" size={20} color={Colors.redUrgent} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: Colors.redUrgent }]}>Payment Past Due</Text>
          <Text style={styles.subtitle}>Update payment method to keep your service active</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.redUrgent} />
      </TouchableOpacity>
    );
  }

  if (status === 'cancelling' || status === 'cancelled') {
    return (
      <TouchableOpacity style={[styles.banner, { backgroundColor: Colors.grayInactive + '15', borderColor: Colors.grayInactive }]} onPress={() => router.push('/billing')}>
        <Ionicons name="time" size={20} color={Colors.grayInactive} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: Colors.textSecondary }]}>Subscription Cancelling</Text>
          <Text style={styles.subtitle}>Reactivate anytime · Tap to manage</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.grayInactive} />
      </TouchableOpacity>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  title: { fontSize: 14, fontWeight: '800' },
  subtitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  bold: { fontWeight: '800', color: Colors.textPrimary },
});
