/**
 * Billing & Plans - Tenant admin subscription management.
 *
 * Features:
 *   - Current plan summary card (trial status, days left, renewal date)
 *   - 3 plan cards (Starter $29, Pro $79, Enterprise $199) with feature lists
 *   - Upgrade / downgrade button (changes plan via /api/tenants/upgrade)
 *   - Cancel subscription (soft-cancel, continues until period end)
 *   - Reactivate (if cancelling)
 *   - 14-day trial indicator
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    'Up to 5 properties',
    'Up to 3 team members',
    'Turnover scheduling + checklists',
    'iCal reservation sync',
    'Email notifications',
    'Guest messaging inbox',
  ],
  pro: [
    'Up to 15 properties',
    'Up to 10 team members',
    'Everything in Starter',
    'SMS delivery (QUO/Twilio)',
    'AI smart checklists & concierge',
    'PMS integrations (Hostaway, Lodgify, etc.)',
    'Cleaner scorecards + photo metrics',
    'Advanced reports + CSV exports',
    'Guest phone verification (2FA)',
    'Housecall Pro integration',
  ],
  enterprise: [
    'Unlimited properties + team',
    'Everything in Pro',
    'White-label branding',
    'Custom subdomain',
    'API access',
    'Multi-admin seats',
    'Priority support',
    'Dedicated onboarding',
  ],
};

const PLAN_TIERS = ['starter', 'pro', 'enterprise'];

export default function BillingScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [plansRes, tenantRes] = await Promise.all([
        api.get('/tenants/plans'),
        api.get('/tenants/me'),
      ]);
      setPlans(plansRes.data || []);
      setTenant(tenantRes.data || null);
    } catch (e: any) {
      console.error('billing load error:', e?.response?.data || e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changePlan = async (planId: string) => {
    if (!tenant) return;
    const current = tenant.plan || 'starter';
    if (planId === current) return;

    const currentIdx = PLAN_TIERS.indexOf(current);
    const newIdx = PLAN_TIERS.indexOf(planId);
    const action = newIdx > currentIdx ? 'Upgrade' : 'Downgrade';
    const price = plans.find(p => p.id === planId)?.price || 0;

    Alert.alert(
      `${action} to ${planId.charAt(0).toUpperCase() + planId.slice(1)}?`,
      `${action === 'Upgrade' ? 'Unlock' : 'Switch to'} ${planId.toUpperCase()} plan at $${price}/month.${tenant.is_in_trial ? '\n\nYour free trial continues — you wonft be charged until it ends.' : ''}`,
      [
        { text: 'Cancel' },
        { text: action, onPress: async () => {
          setBusy(true);
          try {
            await api.post('/tenants/upgrade', { plan: planId });
            Alert.alert('Success', `Plan changed to ${planId.toUpperCase()}`);
            await load();
          } catch (e: any) {
            Alert.alert('Failed', e?.response?.data?.detail || 'Try again');
          } finally {
            setBusy(false);
          }
        }},
      ]
    );
  };

  const cancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription?',
      'Your subscription will remain active until the end of your current billing period, then cancel automatically. You wonft be charged again.',
      [
        { text: 'Keep Subscription' },
        { text: 'Cancel Subscription', style: 'destructive', onPress: async () => {
          setBusy(true);
          try {
            await api.post('/tenants/cancel');
            Alert.alert('Cancelled', 'Your subscription will end at the current period.');
            await load();
          } catch (e: any) {
            Alert.alert('Failed', e?.response?.data?.detail || 'Try again');
          } finally {
            setBusy(false);
          }
        }},
      ]
    );
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const currentPlan = tenant?.plan || 'starter';
  const status = tenant?.status || 'active';
  const daysLeft = tenant?.trial_days_left ?? 0;
  const inTrial = tenant?.is_in_trial;
  const cancelling = status === 'cancelling' || status === 'cancelled';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Billing & Plans</Text>
      </View>

      {/* Current Plan Card */}
      <View style={styles.currentCard}>
        <View style={styles.currentHead}>
          <View style={styles.currentIcon}>
            <Ionicons name="card" size={22} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.currentLabel}>CURRENT PLAN</Text>
            <Text style={styles.currentName}>{currentPlan.toUpperCase()}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: inTrial ? Colors.primary + '20' : status === 'active' ? Colors.greenReady + '20' : status === 'past_due' ? Colors.redUrgent + '20' : Colors.grayInactive + '20' }]}>
            <Text style={[styles.statusText, { color: inTrial ? Colors.primary : status === 'active' ? Colors.greenReady : status === 'past_due' ? Colors.redUrgent : Colors.textSecondary }]}>
              {inTrial ? 'TRIAL' : status.toUpperCase()}
            </Text>
          </View>
        </View>

        {inTrial && (
          <View style={styles.trialInfo}>
            <Ionicons name="gift" size={16} color={Colors.primary} />
            <Text style={styles.trialText}>
              <Text style={styles.bold}>{daysLeft}</Text> {daysLeft === 1 ? 'day' : 'days'} left in your 14-day free trial
            </Text>
          </View>
        )}

        {cancelling && (
          <View style={styles.trialInfo}>
            <Ionicons name="time" size={16} color={Colors.grayInactive} />
            <Text style={[styles.trialText, { color: Colors.textSecondary }]}>Subscription cancelling at period end</Text>
          </View>
        )}

        {tenant?.billing_mode === 'placeholder' && (
          <View style={styles.noBillBox}>
            <Ionicons name="information-circle" size={14} color={Colors.yellowAtRisk} />
            <Text style={styles.noBillText}>Billing not yet configured · No card on file</Text>
          </View>
        )}
      </View>

      {/* Plans */}
      <Text style={styles.sectionTitle}>Choose a Plan</Text>
      <Text style={styles.sectionSub}>Upgrade or downgrade anytime</Text>

      {plans.map(p => {
        const features = PLAN_FEATURES[p.id] || [];
        const isCurrent = p.id === currentPlan;
        const currentIdx = PLAN_TIERS.indexOf(currentPlan);
        const thisIdx = PLAN_TIERS.indexOf(p.id);
        const isUpgrade = thisIdx > currentIdx;
        const isPopular = p.id === 'pro';

        return (
          <View key={p.id} style={[styles.planCard, isCurrent && styles.planCardCurrent, isPopular && !isCurrent && styles.planCardPopular]}>
            {isPopular && !isCurrent && (
              <View style={styles.popularTag}>
                <Text style={styles.popularTagText}>MOST POPULAR</Text>
              </View>
            )}
            <View style={styles.planHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{p.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceAmt}>${p.price}</Text>
                  <Text style={styles.priceUnit}>/month</Text>
                </View>
              </View>
              {isCurrent && (
                <View style={styles.curBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.curBadgeText}>CURRENT</Text>
                </View>
              )}
            </View>

            <View style={styles.featureList}>
              {features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Ionicons name="checkmark" size={16} color={isPopular ? Colors.accent : Colors.greenReady} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            {!isCurrent && (
              <TouchableOpacity
                testID={`plan-${p.id}-btn`}
                style={[styles.planBtn, { backgroundColor: isUpgrade ? (isPopular ? Colors.accent : Colors.primary) : Colors.surfaceSecondary }]}
                disabled={busy}
                onPress={() => changePlan(p.id)}
              >
                <Text style={[styles.planBtnText, { color: isUpgrade ? '#fff' : Colors.textPrimary }]}>
                  {isUpgrade ? 'Upgrade' : 'Downgrade'} to {p.name}
                </Text>
                {isUpgrade && <Ionicons name="arrow-forward" size={16} color="#fff" />}
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* Danger zone */}
      {!cancelling && (
        <TouchableOpacity testID="cancel-sub-btn" style={styles.cancelBtn} onPress={cancelSubscription} disabled={busy}>
          <Ionicons name="close-circle-outline" size={18} color={Colors.redUrgent} />
          <Text style={styles.cancelText}>Cancel Subscription</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.footer}>All plans include a 14-day free trial. Cancel anytime. Billed monthly in USD.</Text>

      {busy && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  backBtn: { padding: 4, marginLeft: -4 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },

  currentCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary, gap: 10 },
  currentHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  currentIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  currentLabel: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 1 },
  currentName: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  trialInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary + '08', padding: 10, borderRadius: 8 },
  trialText: { fontSize: 13, color: Colors.textPrimary },
  bold: { fontWeight: '800' },
  noBillBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.yellowAtRisk + '10', padding: 8, borderRadius: 6 },
  noBillText: { fontSize: 11, color: Colors.textSecondary },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.md },
  sectionSub: { fontSize: 12, color: Colors.textSecondary, marginTop: -6 },

  planCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 10, position: 'relative' },
  planCardCurrent: { borderColor: Colors.primary, borderWidth: 2 },
  planCardPopular: { borderColor: Colors.accent, borderWidth: 1.5 },
  popularTag: { position: 'absolute', top: -10, right: 12, backgroundColor: Colors.accent, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  popularTagText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
  priceAmt: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  priceUnit: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4, marginLeft: 2 },
  curBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  curBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  featureList: { gap: 6, paddingVertical: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: Colors.textPrimary, flex: 1 },

  planBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, marginTop: 4 },
  planBtnText: { fontSize: 14, fontWeight: '800' },

  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.redUrgent + '10', borderWidth: 1, borderColor: Colors.redUrgent + '30', marginTop: Spacing.md },
  cancelText: { fontSize: 14, fontWeight: '700', color: Colors.redUrgent },

  footer: { fontSize: 11, color: Colors.grayInactive, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 16 },
  busyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
});
