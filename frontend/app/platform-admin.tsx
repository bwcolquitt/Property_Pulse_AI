import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function PlatformAdminScreen() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState({ company_name: '', admin_email: '', admin_first_name: '', admin_last_name: '', admin_password: '', plan: 'pro', skip_trial: false });

  const load = async () => {
    try {
      const [t, s] = await Promise.all([api.get('/platform/tenants'), api.get('/platform/stats')]);
      setTenants(t.data); setStats(s.data);
    } catch (e: any) { if (e.response?.status === 403) Alert.alert('Access Denied', 'Platform admin only'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const createTenant = async () => {
    if (!form.company_name || !form.admin_email || !form.admin_password) { Alert.alert('Required', 'Fill all fields'); return; }
    try {
      await api.post('/platform/tenants', form);
      Alert.alert('Created', 'Tenant created successfully');
      setCreateModal(false);
      setForm({ company_name: '', admin_email: '', admin_first_name: '', admin_last_name: '', admin_password: '', plan: 'pro', skip_trial: false });
      load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
  };

  const impersonate = (tid: string, name: string) => {
    Alert.alert('Impersonate', `Log in as ${name}'s admin?`, [
      { text: 'Cancel' },
      { text: 'Impersonate', onPress: async () => { try { await api.post('/platform/impersonate', { tenant_id: tid }); Alert.alert('Impersonating', 'Reload app to see their workspace'); } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); } } },
    ]);
  };

  const toggleActive = (tenant: any) => {
    const action = tenant.active ? 'deactivate' : 'activate';
    Alert.alert(`${action[0].toUpperCase()}${action.slice(1)}?`, `${action} ${tenant.name}?`, [
      { text: 'Cancel' },
      { text: 'Confirm', onPress: async () => { await api.post(`/platform/tenants/${tenant.tenant_id}/${action}`); load(); } },
    ]);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Platform Admin</Text>
        <Text style={styles.subtitle}>All tenants across the Property Pulse SaaS</Text>

        {stats && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}><Text style={styles.statNum}>{stats.total_tenants}</Text><Text style={styles.statLabel}>Total Tenants</Text></View>
            <View style={styles.statCard}><Text style={[styles.statNum, { color: Colors.greenReady }]}>{stats.active}</Text><Text style={styles.statLabel}>Active</Text></View>
            <View style={styles.statCard}><Text style={[styles.statNum, { color: Colors.yellowAtRisk }]}>{stats.trialing}</Text><Text style={styles.statLabel}>Trialing</Text></View>
            <View style={styles.statCard}><Text style={[styles.statNum, { color: Colors.accent }]}>${stats.mrr}</Text><Text style={styles.statLabel}>MRR</Text></View>
          </View>
        )}

        <Text style={styles.section}>Tenants ({tenants.length})</Text>
        {tenants.map((t: any) => (
          <View key={t.tenant_id} style={[styles.tCard, !t.active && styles.tCardSuspended]}>
            <View style={styles.tHead}>
              <View style={{ flex: 1 }}>
                <View style={styles.tNameRow}>
                  <Text style={styles.tName}>{t.name}</Text>
                  <View style={[styles.planPill, { backgroundColor: t.plan === 'enterprise' ? Colors.accent + '20' : t.plan === 'pro' ? Colors.primary + '20' : Colors.grayInactive + '20' }]}>
                    <Text style={[styles.planPillText, { color: t.plan === 'enterprise' ? Colors.accent : t.plan === 'pro' ? Colors.primary : Colors.textSecondary }]}>{t.plan.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.tEmail}>{t.owner_email} · {t.slug}</Text>
                <View style={styles.tMetaRow}>
                  <Text style={styles.tMeta}>{t.user_count} users · {t.property_count} properties</Text>
                  <View style={[styles.statusDot, { backgroundColor: t.status === 'trialing' ? Colors.yellowAtRisk : t.status === 'active' ? Colors.greenReady : Colors.grayInactive }]} />
                  <Text style={styles.tMeta}>{t.status}</Text>
                </View>
              </View>
            </View>
            <View style={styles.tBtns}>
              {t.tenant_id !== 'default' && <TouchableOpacity style={styles.tBtn} onPress={() => impersonate(t.tenant_id, t.name)}><Ionicons name="swap-horizontal" size={13} color={Colors.primary} /><Text style={styles.tBtnText}>Impersonate</Text></TouchableOpacity>}
              <TouchableOpacity style={styles.tBtn} onPress={() => toggleActive(t)}>
                <Ionicons name={t.active ? 'pause' : 'play'} size={13} color={t.active ? Colors.redUrgent : Colors.greenReady} />
                <Text style={[styles.tBtnText, { color: t.active ? Colors.redUrgent : Colors.greenReady }]}>{t.active ? 'Suspend' : 'Activate'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setCreateModal(true)}><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity>

      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <View style={styles.modalOverlay}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}><View style={styles.modal}>
          <Text style={styles.modalTitle}>Create Tenant (Integration Partner)</Text>
          <Text style={styles.mLabel}>Company Name *</Text><TextInput style={styles.input} value={form.company_name} onChangeText={v => setForm({ ...form, company_name: v })} placeholder="Acme Rentals" placeholderTextColor={Colors.grayInactive} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Text style={styles.mLabel}>Admin First *</Text><TextInput style={styles.input} value={form.admin_first_name} onChangeText={v => setForm({ ...form, admin_first_name: v })} placeholderTextColor={Colors.grayInactive} /></View>
            <View style={{ flex: 1 }}><Text style={styles.mLabel}>Admin Last</Text><TextInput style={styles.input} value={form.admin_last_name} onChangeText={v => setForm({ ...form, admin_last_name: v })} placeholderTextColor={Colors.grayInactive} /></View>
          </View>
          <Text style={styles.mLabel}>Admin Email *</Text><TextInput style={styles.input} value={form.admin_email} onChangeText={v => setForm({ ...form, admin_email: v })} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={Colors.grayInactive} />
          <Text style={styles.mLabel}>Admin Password *</Text><TextInput style={styles.input} value={form.admin_password} onChangeText={v => setForm({ ...form, admin_password: v })} secureTextEntry placeholderTextColor={Colors.grayInactive} />
          <Text style={styles.mLabel}>Plan</Text>
          <View style={styles.chipRow}>{['starter', 'pro', 'enterprise'].map(p => (
            <TouchableOpacity key={p} style={[styles.chip, form.plan === p && styles.chipActive]} onPress={() => setForm({ ...form, plan: p })}><Text style={[styles.chipText, form.plan === p && { color: '#fff' }]}>{p}</Text></TouchableOpacity>
          ))}</View>
          <View style={styles.mActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={createTenant}><Text style={styles.saveText}>Create Tenant</Text></TouchableOpacity>
          </View>
        </View></ScrollView></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  title: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary },
  statsGrid: { flexDirection: 'row', gap: 6, marginTop: 8 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary },
  statLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  section: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, marginTop: 14, textTransform: 'uppercase' },
  tCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  tCardSuspended: { opacity: 0.6, borderColor: Colors.redUrgent + '40' },
  tHead: { flexDirection: 'row' },
  tNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tName: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  planPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  planPillText: { fontSize: 9, fontWeight: '800' },
  tEmail: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  tMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tMeta: { fontSize: 11, color: Colors.textSecondary },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  tBtns: { flexDirection: 'row', gap: 6 },
  tBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  tBtnText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, gap: 6, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  mLabel: { fontSize: 11, fontWeight: '800', color: Colors.textPrimary, marginTop: 6, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  mActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: Colors.primary },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
