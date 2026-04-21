/**
 * UpgradeModal - shown when user tries to access a feature their plan doesn't include.
 *
 * Usage:
 *   const [showUpgrade, setShowUpgrade] = useState(false);
 *   <UpgradeModal visible={showUpgrade} onClose={() => setShowUpgrade(false)} feature="sms" requiredPlan="pro" />
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../constants/theme';
import api from '../utils/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  feature?: string;  // 'sms' | 'email' | 'ai' | 'hcp' | etc.
  requiredPlan?: string;
}

const FEATURE_LABELS: Record<string, string> = {
  sms: 'SMS delivery automation',
  email: 'Email delivery',
  pms: 'PMS API integrations',
  ai: 'AI concierge & smart features',
  otp: 'Guest phone verification (2FA)',
  white_label: 'White-label branding',
  push: 'Push notifications',
  assets: 'Property asset tracking',
  owner_storage: 'Owner storage QR',
  csv_export: 'CSV exports',
  advanced_reports: 'Advanced reports',
  hcp: 'Housecall Pro integration',
  scorecards: 'Cleaner scorecards',
  api_access: 'API access',
  multi_admin: 'Multi-admin seats',
};

export default function UpgradeModal({ visible, onClose, feature = '', requiredPlan = 'pro' }: Props) {
  const [plans, setPlans] = useState<any[]>([]);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      Promise.all([api.get('/tenants/plans'), api.get('/tenants/me').catch(() => ({ data: null }))])
        .then(([p, t]) => { setPlans(p.data); setTenant(t.data); });
    }
  }, [visible]);

  const upgrade = async (planId: string) => {
    setLoading(true);
    try {
      await api.post('/tenants/upgrade', { plan: planId });
      Alert.alert('Upgraded!', `Plan changed to ${planId}. Feature now unlocked.`);
      onClose();
    } catch (e: any) {
      Alert.alert('Failed', e.response?.data?.detail || 'Try again');
    } finally { setLoading(false); }
  };

  const currentPlan = tenant?.plan || 'starter';
  const featureLabel = FEATURE_LABELS[feature] || feature;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.head}>
            <Ionicons name="lock-closed" size={24} color={Colors.accent} />
            <Text style={styles.title}>Upgrade Required</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>

          {feature && (
            <View style={styles.featureBox}>
              <Text style={styles.featureText}>
                <Text style={styles.featureBold}>{featureLabel}</Text> requires the <Text style={styles.featureBold}>{requiredPlan.toUpperCase()}</Text> plan or higher.
              </Text>
              <Text style={styles.currentPlan}>You're currently on the <Text style={{ fontWeight: '800' }}>{currentPlan.toUpperCase()}</Text> plan.</Text>
            </View>
          )}

          <Text style={styles.section}>Choose a plan</Text>
          {plans.filter(p => p.id !== 'starter' || currentPlan === 'starter').map(p => (
            <TouchableOpacity key={p.id} style={[styles.planRow, p.id === currentPlan && styles.planCurrent]} onPress={() => p.id !== currentPlan && upgrade(p.id)} disabled={loading || p.id === currentPlan}>
              <View style={{ flex: 1 }}>
                <View style={styles.planTitleRow}>
                  <Text style={styles.planName}>{p.name}</Text>
                  {p.id === currentPlan && <View style={styles.currentBadge}><Text style={styles.currentText}>CURRENT</Text></View>}
                  {p.id === 'pro' && <View style={styles.popularBadge}><Text style={styles.popularText}>POPULAR</Text></View>}
                </View>
                <Text style={styles.planCaps}>{p.properties_cap === -1 ? 'Unlimited properties' : `Up to ${p.properties_cap} properties`} · {p.users_cap === -1 ? 'unlimited' : `${p.users_cap}`} team</Text>
              </View>
              <View style={styles.priceBox}>
                <Text style={styles.price}>${p.price}</Text>
                <Text style={styles.priceMo}>/mo</Text>
              </View>
              {p.id !== currentPlan && <Ionicons name="arrow-forward" size={18} color={Colors.primary} />}
            </TouchableOpacity>
          ))}

          {loading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 10 }} />}

          <TouchableOpacity style={styles.dismissBtn} onPress={onClose}>
            <Text style={styles.dismissText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '90%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  featureBox: { backgroundColor: Colors.accent + '10', borderRadius: 10, padding: Spacing.md, borderWidth: 1, borderColor: Colors.accent + '35', gap: 4 },
  featureText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  featureBold: { fontWeight: '800', color: Colors.accent },
  currentPlan: { fontSize: 12, color: Colors.textSecondary },
  section: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', marginTop: 8 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border },
  planCurrent: { opacity: 0.6, borderColor: Colors.primary },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planName: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  currentBadge: { backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  currentText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  popularBadge: { backgroundColor: Colors.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  popularText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  planCaps: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  priceBox: { flexDirection: 'row', alignItems: 'flex-end' },
  price: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  priceMo: { fontSize: 10, color: Colors.textSecondary, marginBottom: 3, marginLeft: 2 },
  dismissBtn: { paddingVertical: 12, alignItems: 'center' },
  dismissText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
});
