import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, RefreshControl, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function OwnersInventoryScreen() {
  const [boxes, setBoxes] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [createModal, setCreateModal] = useState(false);
  const [detailBox, setDetailBox] = useState<any>(null);
  const [form, setForm] = useState({ property_id: '', label: '', location: '', access_notes: '', contents: '', owner_only: true });

  const fetchData = useCallback(async () => {
    try {
      const params: any = {};
      if (propertyFilter !== 'all') params.property_id = propertyFilter;
      const [bRes, pRes] = await Promise.all([api.get('/owners-inventory', { params }), api.get('/properties')]);
      setBoxes(bRes.data);
      setProperties(pRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [propertyFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createBox = async () => {
    if (!form.property_id || !form.label) { Alert.alert('Required', 'Select property and add label'); return; }
    try {
      const { data } = await api.post('/owners-inventory', {
        ...form,
        contents: form.contents.split(',').map(s => s.trim()).filter(Boolean),
      });
      Alert.alert('Created', `QR code: ${data.qr_code}`);
      setCreateModal(false);
      setForm({ property_id: '', label: '', location: '', access_notes: '', contents: '', owner_only: true });
      fetchData();
    } catch { Alert.alert('Error', 'Failed to create'); }
  };

  const deleteBox = (id: string, label: string) => {
    Alert.alert('Delete Box', `Remove "${label}"?`, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/owners-inventory/${id}`); fetchData(); } },
    ]);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Owner Storage Boxes</Text>
        <Text style={styles.subtitle}>Track personal items kept on-site with QR codes</Text>
      </View>

      {/* Property Filter */}
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={['all', ...properties.map((p: any) => p.id)]} keyExtractor={c => c} contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => {
          const prop = properties.find(p => p.id === item);
          const label = item === 'all' ? 'All' : (prop?.nickname || prop?.name || 'Prop');
          return (
            <TouchableOpacity style={[styles.filterBtn, propertyFilter === item && styles.filterActive]} onPress={() => setPropertyFilter(item)}>
              <Text style={[styles.filterText, propertyFilter === item && styles.filterTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <FlatList
        data={boxes}
        keyExtractor={b => b.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="cube-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No storage boxes tracked</Text><Text style={styles.emptyHint}>Tap + to track your first box</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setDetailBox(item)}>
            <View style={styles.iconBox}><Ionicons name="cube" size={22} color={Colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.cardMeta}>{item.property_name || 'Unknown property'} · {item.location || 'No location'}</Text>
              {item.contents && item.contents.length > 0 && <Text style={styles.cardContents} numberOfLines={1}>{item.contents.length} items: {item.contents.slice(0, 3).join(', ')}{item.contents.length > 3 ? '...' : ''}</Text>}
              <View style={styles.qrBadge}><Ionicons name="qr-code" size={12} color={Colors.primary} /><Text style={styles.qrText}>{item.qr_code}</Text></View>
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setCreateModal(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}><ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.modal}>
          <Text style={styles.modalTitle}>Track Storage Box</Text>

          <Text style={styles.label}>Property *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.chipRow}>
            {properties.map(p => (
              <TouchableOpacity key={p.id} style={[styles.chip, form.property_id === p.id && styles.chipActive]} onPress={() => setForm({ ...form, property_id: p.id })}>
                <Text style={[styles.chipText, form.property_id === p.id && { color: '#fff' }]}>{p.nickname || p.name}</Text>
              </TouchableOpacity>
            ))}
          </View></ScrollView>

          <Text style={styles.label}>Box Label *</Text>
          <TextInput style={styles.input} value={form.label} onChangeText={v => setForm({ ...form, label: v })} placeholder="e.g., Beach Gear Box" placeholderTextColor={Colors.grayInactive} />

          <Text style={styles.label}>Location</Text>
          <TextInput style={styles.input} value={form.location} onChangeText={v => setForm({ ...form, location: v })} placeholder="e.g., Garage Shelf 2" placeholderTextColor={Colors.grayInactive} />

          <Text style={styles.label}>Access Notes</Text>
          <TextInput style={[styles.input, { height: 60 }]} multiline value={form.access_notes} onChangeText={v => setForm({ ...form, access_notes: v })} placeholder="Key location, combo, etc." placeholderTextColor={Colors.grayInactive} />

          <Text style={styles.label}>Contents (comma-separated)</Text>
          <TextInput style={[styles.input, { height: 60 }]} multiline value={form.contents} onChangeText={v => setForm({ ...form, contents: v })} placeholder="Beach towels, snorkels, sand toys" placeholderTextColor={Colors.grayInactive} />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={createBox}><Ionicons name="qr-code" size={16} color="#fff" /><Text style={styles.saveText}>Generate QR</Text></TouchableOpacity>
          </View>
        </View></ScrollView></View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!detailBox} transparent animationType="fade" onRequestClose={() => setDetailBox(null)}>
        <View style={styles.modalOverlay}><View style={styles.modal}>
          {detailBox && (<>
            <View style={styles.dHead}><Text style={styles.modalTitle}>{detailBox.label}</Text><TouchableOpacity onPress={() => setDetailBox(null)}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity></View>
            <View style={styles.qrDisplay}><Ionicons name="qr-code" size={80} color={Colors.primary} /><Text style={styles.qrCodeText}>{detailBox.qr_code}</Text><Text style={styles.qrHint}>Print & stick on the box</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Property:</Text><Text style={styles.detailVal}>{detailBox.property_name}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Location:</Text><Text style={styles.detailVal}>{detailBox.location || '—'}</Text></View>
            {detailBox.access_notes && <View><Text style={styles.detailLabel}>Access:</Text><Text style={styles.detailBody}>{detailBox.access_notes}</Text></View>}
            {detailBox.contents && detailBox.contents.length > 0 && (
              <View><Text style={styles.detailLabel}>Contents:</Text>
                {detailBox.contents.map((c: string, i: number) => <Text key={i} style={styles.contentLine}>• {c}</Text>)}
              </View>
            )}
            <TouchableOpacity style={styles.deleteBtn} onPress={() => { setDetailBox(null); deleteBox(detailBox.id, detailBox.label); }}>
              <Ionicons name="trash" size={16} color={Colors.redUrgent} />
              <Text style={styles.deleteText}>Delete Box</Text>
            </TouchableOpacity>
          </>)}
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { padding: Spacing.md },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  filterRow: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.accent + '15', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cardContents: { fontSize: 12, color: Colors.textPrimary, marginTop: 4 },
  qrBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start', backgroundColor: Colors.primary + '10', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  qrText: { fontSize: 10, fontWeight: '700', color: Colors.primary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  emptyHint: { fontSize: 13, color: Colors.grayInactive },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '95%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, marginTop: 6, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: Colors.accent },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // Detail
  dHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qrDisplay: { alignItems: 'center', gap: 8, padding: Spacing.md, backgroundColor: Colors.surfaceSecondary, borderRadius: 12 },
  qrCodeText: { fontSize: 18, fontWeight: '800', color: Colors.primary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  qrHint: { fontSize: 12, color: Colors.textSecondary },
  detailRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  detailVal: { fontSize: 14, color: Colors.textPrimary, flex: 1 },
  detailBody: { fontSize: 13, color: Colors.textPrimary, marginTop: 4, lineHeight: 18 },
  contentLine: { fontSize: 13, color: Colors.textPrimary, marginTop: 2 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.redUrgent, marginTop: Spacing.sm },
  deleteText: { fontSize: 14, fontWeight: '700', color: Colors.redUrgent },
});
