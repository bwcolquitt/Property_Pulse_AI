import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const STATUS_COLORS: Record<string, string> = { completed: Colors.greenReady, pending: Colors.yellowAtRisk, failed: Colors.redUrgent, pending_config: Colors.grayInactive };

export default function PaymentSettingsScreen() {
  const [config, setConfig] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ stripe_publishable_key: '', stripe_secret_key: '', auto_pay_enabled: false, auto_pay_on_job_complete: true, default_currency: 'usd' });
  const [editProvider, setEditProvider] = useState<any>(null);
  const [provForm, setProvForm] = useState({ stripe_account_id: '', payment_email: '', bank_name: '', account_last4: '' });
  const [activeTab, setActiveTab] = useState<'config' | 'providers' | 'history'>('config');

  const fetchAll = async () => {
    try {
      const [cRes, pRes, hRes, sRes] = await Promise.all([
        api.get('/payments/config'),
        api.get('/payments/providers'),
        api.get('/payments/history'),
        api.get('/payments/stats'),
      ]);
      setConfig(cRes.data);
      setProviders(pRes.data);
      setPayments(hRes.data);
      setStats(sRes.data);
      setForm({
        stripe_publishable_key: cRes.data.stripe_publishable_key || '',
        stripe_secret_key: cRes.data.stripe_secret_key_masked || '',
        auto_pay_enabled: cRes.data.auto_pay_enabled || false,
        auto_pay_on_job_complete: cRes.data.auto_pay_on_job_complete ?? true,
        default_currency: cRes.data.default_currency || 'usd',
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await api.put('/payments/config', form);
      Alert.alert('Saved', 'Payment configuration updated');
      fetchAll();
    } catch { Alert.alert('Error', 'Failed to save'); }
    finally { setSaving(false); }
  };

  const saveProvider = async () => {
    if (!editProvider) return;
    try {
      await api.put(`/payments/providers/${editProvider.provider_id || editProvider.id}`, {
        provider_id: editProvider.provider_id || editProvider.id,
        payment_method: 'stripe_connect',
        stripe_account_id: provForm.stripe_account_id,
        payment_email: provForm.payment_email,
        bank_name: provForm.bank_name,
        account_last4: provForm.account_last4,
      });
      Alert.alert('Saved', 'Provider payment info updated');
      setEditProvider(null);
      fetchAll();
    } catch { Alert.alert('Error', 'Failed to save'); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stats */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}><Text style={[styles.statNum, { color: Colors.greenReady }]}>${(stats.total_paid || 0).toLocaleString()}</Text><Text style={styles.statLabel}>Total Paid</Text></View>
          <View style={styles.statCard}><Text style={styles.statNum}>{stats.completed_count}</Text><Text style={styles.statLabel}>Completed</Text></View>
          <View style={styles.statCard}><Text style={[styles.statNum, { color: Colors.yellowAtRisk }]}>{stats.pending_count}</Text><Text style={styles.statLabel}>Pending</Text></View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['config', 'providers', 'history'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t === 'config' ? 'Stripe Setup' : t === 'providers' ? 'Providers' : 'History'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Config Tab */}
      {activeTab === 'config' && (
        <View style={styles.section}>
          <View style={styles.configHeader}>
            <Ionicons name="card" size={22} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Stripe Configuration</Text>
          </View>
          <Text style={styles.hint}>Enter your Stripe API keys from dashboard.stripe.com</Text>

          <Text style={styles.label}>Publishable Key</Text>
          <TextInput style={styles.input} value={form.stripe_publishable_key} onChangeText={v => setForm({...form, stripe_publishable_key: v})} placeholder="pk_live_..." autoCapitalize="none" placeholderTextColor={Colors.grayInactive} />

          <Text style={styles.label}>Secret Key</Text>
          <TextInput style={styles.input} value={form.stripe_secret_key} onChangeText={v => setForm({...form, stripe_secret_key: v})} placeholder="sk_live_..." autoCapitalize="none" secureTextEntry placeholderTextColor={Colors.grayInactive} />
          {config?.stripe_secret_key_set && <Text style={styles.keySet}>Secret key is configured ({config.stripe_secret_key_masked})</Text>}

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}><Text style={styles.toggleLabel}>Auto-Pay Enabled</Text><Text style={styles.toggleHint}>Automatically process payments</Text></View>
            <Switch value={form.auto_pay_enabled} onValueChange={v => setForm({...form, auto_pay_enabled: v})} trackColor={{ true: Colors.primary, false: Colors.border }} />
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}><Text style={styles.toggleLabel}>Pay on Job Complete</Text><Text style={styles.toggleHint}>Auto-charge when job status changes to completed</Text></View>
            <Switch value={form.auto_pay_on_job_complete} onValueChange={v => setForm({...form, auto_pay_on_job_complete: v})} trackColor={{ true: Colors.primary, false: Colors.border }} />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={saveConfig} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.saveBtnText}>Save Configuration</Text></>}
          </TouchableOpacity>
        </View>
      )}

      {/* Providers Tab */}
      {activeTab === 'providers' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Provider Payment Setup</Text>
          {providers.length === 0 && <Text style={styles.emptyText}>No providers configured for payments yet. Set up payment info for each provider to enable auto-pay.</Text>}
          {providers.map((p, i) => (
            <TouchableOpacity key={i} style={styles.provCard} onPress={() => { setEditProvider(p); setProvForm({ stripe_account_id: p.stripe_account_id || '', payment_email: p.payment_email || '', bank_name: p.bank_name || '', account_last4: p.account_last4 || '' }); }}>
              <Ionicons name="person-circle" size={28} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.provName}>{p.provider_name || 'Provider'}</Text>
                <Text style={styles.provMeta}>{p.payment_method || 'Not set'} {p.stripe_account_id ? '- Connected' : ''}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.grayInactive} />
            </TouchableOpacity>
          ))}

          {editProvider && (
            <View style={styles.editBox}>
              <Text style={styles.editTitle}>Payment Info: {editProvider.provider_name}</Text>
              <Text style={styles.label}>Stripe Account ID</Text>
              <TextInput style={styles.input} value={provForm.stripe_account_id} onChangeText={v => setProvForm({...provForm, stripe_account_id: v})} placeholder="acct_..." autoCapitalize="none" placeholderTextColor={Colors.grayInactive} />
              <Text style={styles.label}>Payment Email</Text>
              <TextInput style={styles.input} value={provForm.payment_email} onChangeText={v => setProvForm({...provForm, payment_email: v})} placeholder="provider@email.com" autoCapitalize="none" placeholderTextColor={Colors.grayInactive} />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditProvider(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveProvider}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          {payments.length === 0 && <Text style={styles.emptyText}>No payments processed yet</Text>}
          {payments.map((p, i) => {
            const statColor = STATUS_COLORS[p.status] || Colors.grayInactive;
            return (
              <View key={i} style={styles.payCard}>
                <View style={[styles.payStripe, { backgroundColor: statColor }]} />
                <View style={styles.payBody}>
                  <View style={styles.payTop}>
                    <Text style={styles.payAmount}>${(p.amount || 0).toFixed(2)}</Text>
                    <View style={[styles.payBadge, { backgroundColor: statColor + '15' }]}><Text style={[styles.payBadgeText, { color: statColor }]}>{p.status}</Text></View>
                  </View>
                  <Text style={styles.payProvider}>{p.provider_name || 'Provider'}</Text>
                  {p.description && <Text style={styles.payDesc}>{p.description}</Text>}
                  <Text style={styles.payDate}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  statNum: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  tabRow: { flexDirection: 'row', gap: Spacing.sm },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
  section: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  configHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  hint: { fontSize: 12, color: Colors.textSecondary },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginTop: 4 },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  keySet: { fontSize: 11, color: Colors.greenReady, fontStyle: 'italic' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  toggleHint: { fontSize: 11, color: Colors.textSecondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary, marginTop: Spacing.sm },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.md },
  provCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  provName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  provMeta: { fontSize: 12, color: Colors.textSecondary },
  editBox: { backgroundColor: Colors.primary + '08', borderRadius: 10, padding: Spacing.md, gap: Spacing.sm, marginTop: Spacing.sm },
  editTitle: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  editActions: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  payCard: { flexDirection: 'row', backgroundColor: Colors.surfaceSecondary, borderRadius: 10, overflow: 'hidden' },
  payStripe: { width: 4 },
  payBody: { flex: 1, padding: Spacing.sm, gap: 2 },
  payTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payAmount: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  payBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  payBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  payProvider: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  payDesc: { fontSize: 12, color: Colors.textSecondary },
  payDate: { fontSize: 11, color: Colors.grayInactive },
});
