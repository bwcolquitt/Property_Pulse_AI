import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';
import * as ImagePicker from 'expo-image-picker';

export default function OnsitePurchaseScreen() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState({ property_id: '', item_name: '', quantity: '1', unit_cost: '', notes: '' });
  const [receiptPhoto, setReceiptPhoto] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [pRes, propRes] = await Promise.all([api.get('/onsite-purchases'), api.get('/properties')]);
      setPurchases(pRes.data);
      setProperties(propRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const takeReceiptPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!result.canceled && result.assets?.[0]) setReceiptPhoto(result.assets[0].uri);
  };

  const submit = async () => {
    if (!form.property_id || !form.item_name || !form.unit_cost) { Alert.alert('Required', 'Select property, item name, and cost'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post('/onsite-purchases', {
        property_id: form.property_id, item_name: form.item_name,
        quantity: parseInt(form.quantity) || 1, unit_cost: parseFloat(form.unit_cost) || 0,
        receipt_photo_base64: receiptPhoto, notes: form.notes,
      });
      Alert.alert('Submitted', `Total to admin: $${data.ai_breakdown.total_to_admin} (includes 25% service fee of $${data.ai_breakdown.service_fee_25_pct})`);
      setCreateModal(false); setForm({ property_id: '', item_name: '', quantity: '1', unit_cost: '', notes: '' }); setReceiptPhoto('');
      fetchData();
    } catch { Alert.alert('Error', 'Failed'); }
    finally { setSubmitting(false); }
  };

  const STATUS_COLORS: Record<string, string> = { pending_approval: Colors.yellowAtRisk, approved: Colors.greenReady, rejected: Colors.redUrgent };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <FlatList data={purchases} keyExtractor={p => p.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <View style={styles.headerInfo}>
            <Ionicons name="receipt" size={22} color={Colors.accent} />
            <Text style={styles.headerTitle}>On-Site Purchases</Text>
            <Text style={styles.headerSub}>Buy supplies on-site, upload receipt, 25% service fee auto-calculated</Text>
          </View>
        }
        renderItem={({ item: p }) => {
          const statColor = STATUS_COLORS[p.status] || Colors.grayInactive;
          return (
            <View style={styles.pCard}>
              <View style={[styles.pStripe, { backgroundColor: statColor }]} />
              <View style={styles.pBody}>
                <View style={styles.pTop}>
                  <Text style={styles.pName}>{p.item_name}</Text>
                  <View style={[styles.pBadge, { backgroundColor: statColor + '15' }]}><Text style={[styles.pBadgeText, { color: statColor }]}>{p.status?.replace(/_/g, ' ')}</Text></View>
                </View>
                <Text style={styles.pProp}>{p.property_name} · Qty {p.quantity}</Text>
                <View style={styles.pBreakdown}>
                  <Text style={styles.pLine}>Subtotal: ${p.subtotal?.toFixed(2)}</Text>
                  <Text style={styles.pLine}>Service Fee (25%): ${p.service_fee?.toFixed(2)}</Text>
                  <Text style={styles.pTotal}>Total: ${p.total?.toFixed(2)}</Text>
                </View>
                {p.has_receipt && <View style={styles.receiptBadge}><Ionicons name="document-attach" size={12} color={Colors.greenReady} /><Text style={styles.receiptText}>Receipt attached</Text></View>}
                <Text style={styles.pBy}>By {p.submitted_by_name}</Text>
                {p.status === 'pending_approval' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => api.put(`/onsite-purchases/${p.id}`, { action: 'approve' }).then(fetchData)}><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.appText}>Approve</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => api.put(`/onsite-purchases/${p.id}`, { action: 'reject' }).then(fetchData)}><Text style={styles.rejText}>Reject</Text></TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="receipt-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No on-site purchases yet</Text></View>}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setCreateModal(true)}><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity>

      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}><ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.modal}>
          <Text style={styles.modalTitle}>Log On-Site Purchase</Text>
          <Text style={styles.modalHint}>AI calculates 25% service fee automatically</Text>
          <Text style={styles.label}>Property *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.chipRow}>
            {properties.map(p => (<TouchableOpacity key={p.id} style={[styles.chip, form.property_id === p.id && styles.chipActive]} onPress={() => setForm({...form, property_id: p.id})}><Text style={[styles.chipText, form.property_id === p.id && { color: '#fff' }]}>{p.nickname || p.name}</Text></TouchableOpacity>))}
          </View></ScrollView>
          <Text style={styles.label}>Item *</Text>
          <TextInput style={styles.input} value={form.item_name} onChangeText={v => setForm({...form, item_name: v})} placeholder="Propane tank, lighters, etc." placeholderTextColor={Colors.grayInactive} />
          <View style={styles.costRow}>
            <View style={{ flex: 1 }}><Text style={styles.label}>Qty</Text><TextInput style={styles.input} value={form.quantity} onChangeText={v => setForm({...form, quantity: v})} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Text style={styles.label}>Unit Cost *</Text><TextInput style={styles.input} value={form.unit_cost} onChangeText={v => setForm({...form, unit_cost: v})} placeholder="$0.00" keyboardType="numeric" placeholderTextColor={Colors.grayInactive} /></View>
          </View>
          {form.unit_cost ? (
            <View style={styles.calcBox}>
              <Text style={styles.calcLine}>Subtotal: ${(parseFloat(form.unit_cost || '0') * (parseInt(form.quantity) || 1)).toFixed(2)}</Text>
              <Text style={styles.calcLine}>Service Fee (25%): ${((parseFloat(form.unit_cost || '0') * (parseInt(form.quantity) || 1)) * 0.25).toFixed(2)}</Text>
              <Text style={styles.calcTotal}>Total: ${((parseFloat(form.unit_cost || '0') * (parseInt(form.quantity) || 1)) * 1.25).toFixed(2)}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.receiptBtn} onPress={takeReceiptPhoto}>
            <Ionicons name={receiptPhoto ? 'checkmark-circle' : 'camera'} size={18} color={receiptPhoto ? Colors.greenReady : Colors.primary} />
            <Text style={[styles.receiptBtnText, receiptPhoto && { color: Colors.greenReady }]}>{receiptPhoto ? 'Receipt Photo Taken' : 'Take Receipt Photo'}</Text>
          </TouchableOpacity>
          <TextInput style={styles.input} value={form.notes} onChangeText={v => setForm({...form, notes: v})} placeholder="Notes (optional)" placeholderTextColor={Colors.grayInactive} />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={submit} disabled={submitting}>{submitting ? <ActivityIndicator color="#fff" /> : <><Ionicons name="send" size={18} color="#fff" /><Text style={styles.saveText}>Submit</Text></>}</TouchableOpacity>
          </View>
        </View></ScrollView></View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  headerInfo: { gap: 4, marginBottom: Spacing.sm },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 13, color: Colors.textSecondary },
  pCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  pStripe: { width: 4 },
  pBody: { flex: 1, padding: Spacing.md, gap: 4 },
  pTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  pBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  pProp: { fontSize: 12, color: Colors.textSecondary },
  pBreakdown: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, padding: Spacing.sm, gap: 2 },
  pLine: { fontSize: 12, color: Colors.textSecondary },
  pTotal: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  receiptBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  receiptText: { fontSize: 11, fontWeight: '600', color: Colors.greenReady },
  pBy: { fontSize: 11, color: Colors.grayInactive },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.greenReady },
  appText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  rejectBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.redUrgent },
  rejText: { fontSize: 13, fontWeight: '700', color: Colors.redUrgent },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '95%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalHint: { fontSize: 12, color: Colors.accent, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginTop: 4 },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  costRow: { flexDirection: 'row', gap: Spacing.sm },
  calcBox: { backgroundColor: Colors.accent + '10', borderRadius: 10, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.accent + '25', gap: 2 },
  calcLine: { fontSize: 13, color: Colors.textSecondary },
  calcTotal: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed' },
  receiptBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: Colors.primary },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
