import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, RefreshControl, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const STATUS_COLORS: Record<string, string> = { pending: Colors.yellowAtRisk, approved: Colors.blueAssigned, rejected: Colors.redUrgent, fulfilled: Colors.greenReady };

export default function SupplyRequestsScreen() {
  const [requests, setRequests] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState({ property_id: '', urgency: 'normal', notes: '' });
  const [items, setItems] = useState([{ name: '', quantity: '1', category: 'cleaning' }]);

  const fetchData = useCallback(async () => {
    try {
      const [rRes, sRes, pRes] = await Promise.all([
        api.get('/supply-requests'),
        api.get('/supply-requests/stats'),
        api.get('/properties'),
      ]);
      setRequests(rRes.data);
      setStats(sRes.data);
      setProperties(pRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addItem = () => setItems([...items, { name: '', quantity: '1', category: 'cleaning' }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, val: string) => {
    const newItems = [...items];
    (newItems[i] as any)[field] = val;
    setItems(newItems);
  };

  const submitRequest = async () => {
    if (!form.property_id) { Alert.alert('Required', 'Select a property'); return; }
    const validItems = items.filter(i => i.name.trim());
    if (validItems.length === 0) { Alert.alert('Required', 'Add at least one item'); return; }
    try {
      await api.post('/supply-requests', {
        property_id: form.property_id,
        urgency: form.urgency,
        notes: form.notes,
        items: validItems.map(i => ({ name: i.name, quantity: parseInt(i.quantity) || 1, category: i.category })),
      });
      Alert.alert('Submitted', 'Supply request sent for approval');
      setCreateModal(false);
      setForm({ property_id: '', urgency: 'normal', notes: '' });
      setItems([{ name: '', quantity: '1', category: 'cleaning' }]);
      fetchData();
    } catch { Alert.alert('Error', 'Failed to submit'); }
  };

  const actionRequest = async (id: string, action: string) => {
    const label = action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Mark Fulfilled';
    Alert.alert(label, `${label} this supply request?`, [
      { text: 'Cancel' },
      { text: label, onPress: async () => {
        try {
          await api.put(`/supply-requests/${id}`, { action });
          fetchData();
        } catch { Alert.alert('Error', 'Failed'); }
      }},
    ]);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Stats */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}><Text style={[styles.statNum, { color: Colors.yellowAtRisk }]}>{stats.pending}</Text><Text style={styles.statLabel}>Pending</Text></View>
          <View style={styles.statCard}><Text style={[styles.statNum, { color: Colors.blueAssigned }]}>{stats.approved}</Text><Text style={styles.statLabel}>Approved</Text></View>
          <View style={styles.statCard}><Text style={[styles.statNum, { color: Colors.greenReady }]}>{stats.fulfilled}</Text><Text style={styles.statLabel}>Fulfilled</Text></View>
        </View>
      )}

      {/* Request List */}
      <FlatList data={requests} keyExtractor={r => r.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Colors.primary} />}
        renderItem={({ item: req }) => {
          const statColor = STATUS_COLORS[req.status] || Colors.grayInactive;
          return (
            <View style={styles.reqCard}>
              <View style={[styles.reqStripe, { backgroundColor: statColor }]} />
              <View style={styles.reqBody}>
                <View style={styles.reqTop}>
                  <View style={[styles.badge, { backgroundColor: statColor + '15' }]}><Text style={[styles.badgeText, { color: statColor }]}>{req.status}</Text></View>
                  {req.urgency === 'urgent' && <View style={[styles.badge, { backgroundColor: Colors.redUrgent + '15' }]}><Text style={[styles.badgeText, { color: Colors.redUrgent }]}>Urgent</Text></View>}
                  <Text style={styles.reqDate}>{req.created_at ? new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</Text>
                </View>
                <Text style={styles.reqProp}>{req.property_name}</Text>
                <Text style={styles.reqBy}>By {req.requested_by_name}</Text>
                <View style={styles.itemsList}>
                  {(req.items || []).map((item: any, i: number) => (
                    <View key={i} style={styles.itemRow}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemQty}>x{item.quantity}</Text>
                    </View>
                  ))}
                </View>
                {req.notes ? <Text style={styles.reqNotes}>{req.notes}</Text> : null}
                {/* Actions */}
                {req.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => actionRequest(req.id, 'approve')}>
                      <Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectActionBtn} onPress={() => actionRequest(req.id, 'reject')}>
                      <Text style={styles.rejectActionText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {req.status === 'approved' && (
                  <TouchableOpacity style={styles.fulfillBtn} onPress={() => actionRequest(req.id, 'fulfill')}>
                    <Ionicons name="cube" size={16} color="#fff" /><Text style={styles.fulfillText}>Mark Fulfilled</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="cart-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No supply requests</Text></View>}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setCreateModal(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}><ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.modal}>
          <Text style={styles.modalTitle}>New Supply Request</Text>
          
          <Text style={styles.label}>Property *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.chipRow}>
            {properties.map(p => (
              <TouchableOpacity key={p.id} style={[styles.chip, form.property_id === p.id && styles.chipActive]} onPress={() => setForm({ ...form, property_id: p.id })}>
                <Text style={[styles.chipText, form.property_id === p.id && { color: '#fff' }]}>{p.nickname || p.name}</Text>
              </TouchableOpacity>
            ))}
          </View></ScrollView>

          <Text style={styles.label}>Items</Text>
          {items.map((item, i) => (
            <View key={i} style={styles.itemInputRow}>
              <TextInput style={[styles.input, { flex: 2 }]} value={item.name} onChangeText={v => updateItem(i, 'name', v)} placeholder="Item name" placeholderTextColor={Colors.grayInactive} />
              <TextInput style={[styles.input, { width: 50 }]} value={item.quantity} onChangeText={v => updateItem(i, 'quantity', v)} keyboardType="numeric" placeholder="Qty" placeholderTextColor={Colors.grayInactive} />
              {items.length > 1 && <TouchableOpacity onPress={() => removeItem(i)}><Ionicons name="close-circle" size={22} color={Colors.redUrgent} /></TouchableOpacity>}
            </View>
          ))}
          <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
            <Ionicons name="add-circle" size={18} color={Colors.primary} /><Text style={styles.addItemText}>Add Item</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Urgency</Text>
          <View style={styles.chipRow}>
            {['normal', 'urgent'].map(u => (
              <TouchableOpacity key={u} style={[styles.chip, form.urgency === u && (u === 'urgent' ? { backgroundColor: Colors.redUrgent, borderColor: Colors.redUrgent } : styles.chipActive)]} onPress={() => setForm({ ...form, urgency: u })}>
                <Text style={[styles.chipText, form.urgency === u && { color: '#fff' }]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput style={styles.input} value={form.notes} onChangeText={v => setForm({ ...form, notes: v })} placeholder="Additional notes..." placeholderTextColor={Colors.grayInactive} />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={submitRequest}><Ionicons name="send" size={18} color="#fff" /><Text style={styles.saveText}>Submit</Text></TouchableOpacity>
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
  statsRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  reqCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  reqStripe: { width: 4 },
  reqBody: { flex: 1, padding: Spacing.md, gap: 6 },
  reqTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  reqDate: { flex: 1, textAlign: 'right', fontSize: 12, color: Colors.textSecondary },
  reqProp: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  reqBy: { fontSize: 12, color: Colors.textSecondary },
  itemsList: { gap: 2, marginTop: 4 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  itemName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  itemQty: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  reqNotes: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.greenReady },
  approveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  rejectActionBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.redUrgent },
  rejectActionText: { fontSize: 13, fontWeight: '700', color: Colors.redUrgent },
  fulfillBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.blueAssigned, marginTop: 4 },
  fulfillText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '95%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  itemInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  addItemText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: Colors.primary },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
