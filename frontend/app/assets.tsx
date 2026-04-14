import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, RefreshControl, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const CATEGORIES = ['appliance', 'furniture', 'fixture', 'electronics', 'outdoor'];
const CONDITIONS = ['new', 'good', 'fair', 'poor', 'needs_replacement'];
const COND_COLORS: Record<string, string> = { new: Colors.greenReady, good: Colors.blueAssigned, fair: Colors.yellowAtRisk, poor: Colors.redUrgent, needs_replacement: Colors.redUrgent };
const CAT_ICONS: Record<string, string> = { appliance: 'cafe', furniture: 'bed', fixture: 'water', electronics: 'tv', outdoor: 'leaf' };

export default function AssetsScreen() {
  const [assets, setAssets] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catFilter, setCatFilter] = useState('all');
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState({ property_id: '', name: '', category: 'appliance', manufacturer: '', model_number: '', serial_number: '', purchase_price: '', warranty_expiry: '', location_in_property: '', condition: 'good', notes: '' });

  const fetchData = useCallback(async () => {
    try {
      const params: any = {};
      if (catFilter !== 'all') params.category = catFilter;
      const [aRes, pRes] = await Promise.all([api.get('/assets', { params }), api.get('/properties')]);
      setAssets(aRes.data);
      setProperties(pRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [catFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createAsset = async () => {
    if (!form.property_id || !form.name) { Alert.alert('Required', 'Select property and enter asset name'); return; }
    try {
      await api.post('/assets', {
        ...form,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        warranty_expiry: form.warranty_expiry || null,
        purchase_date: null,
        install_date: null,
      });
      Alert.alert('Created', 'Asset tracked');
      setCreateModal(false);
      setForm({ property_id: '', name: '', category: 'appliance', manufacturer: '', model_number: '', serial_number: '', purchase_price: '', warranty_expiry: '', location_in_property: '', condition: 'good', notes: '' });
      fetchData();
    } catch { Alert.alert('Error', 'Failed to create'); }
  };

  const deleteAsset = (id: string, name: string) => {
    Alert.alert('Delete Asset', `Remove ${name}?`, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/assets/${id}`); fetchData(); } },
    ]);
  };

  // Stats
  const warrantyExpiring = assets.filter(a => a.warranty_active && a.warranty_days_left <= 30).length;
  const needsReplacement = assets.filter(a => a.condition === 'needs_replacement' || a.condition === 'poor').length;

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statNum}>{assets.length}</Text><Text style={styles.statLabel}>Total Assets</Text></View>
        <View style={[styles.statCard, warrantyExpiring > 0 && { borderColor: Colors.yellowAtRisk }]}><Text style={[styles.statNum, { color: Colors.yellowAtRisk }]}>{warrantyExpiring}</Text><Text style={styles.statLabel}>Expiring Soon</Text></View>
        <View style={[styles.statCard, needsReplacement > 0 && { borderColor: Colors.redUrgent }]}><Text style={[styles.statNum, { color: Colors.redUrgent }]}>{needsReplacement}</Text><Text style={styles.statLabel}>Replace</Text></View>
      </View>

      {/* Category Filter */}
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={['all', ...CATEGORIES]} keyExtractor={c => c} contentContainerStyle={styles.filterRow}
        renderItem={({ item: c }) => (
          <TouchableOpacity style={[styles.filterBtn, catFilter === c && styles.filterActive]} onPress={() => setCatFilter(c)}>
            <Text style={[styles.filterText, catFilter === c && styles.filterTextActive]}>{c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Asset List */}
      <FlatList data={assets} keyExtractor={a => a.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Colors.primary} />}
        renderItem={({ item: asset }) => {
          const condColor = COND_COLORS[asset.condition] || Colors.grayInactive;
          return (
            <View style={styles.assetCard}>
              <View style={styles.assetHeader}>
                <View style={[styles.catIcon, { backgroundColor: (Colors.primary) + '15' }]}>
                  <Ionicons name={(CAT_ICONS[asset.category] || 'cube') as any} size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assetName}>{asset.name}</Text>
                  <Text style={styles.assetProp}>{asset.property_name} {asset.location_in_property ? `- ${asset.location_in_property}` : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteAsset(asset.id, asset.name)}>
                  <Ionicons name="trash-outline" size={18} color={Colors.redUrgent} />
                </TouchableOpacity>
              </View>
              <View style={styles.assetMeta}>
                <View style={[styles.condBadge, { backgroundColor: condColor + '15' }]}><Text style={[styles.condText, { color: condColor }]}>{asset.condition?.replace(/_/g, ' ')}</Text></View>
                {asset.manufacturer ? <Text style={styles.manufacturer}>{asset.manufacturer}</Text> : null}
                {asset.model_number ? <Text style={styles.modelNum}>{asset.model_number}</Text> : null}
              </View>
              {asset.warranty_active && (
                <View style={[styles.warrantyBadge, asset.warranty_days_left <= 30 && { backgroundColor: Colors.yellowAtRisk + '15', borderColor: Colors.yellowAtRisk + '30' }]}>
                  <Ionicons name="shield-checkmark" size={14} color={asset.warranty_days_left <= 30 ? Colors.yellowAtRisk : Colors.greenReady} />
                  <Text style={[styles.warrantyText, { color: asset.warranty_days_left <= 30 ? Colors.yellowAtRisk : Colors.greenReady }]}>
                    Warranty: {asset.warranty_days_left} days left
                  </Text>
                </View>
              )}
              {asset.purchase_price && <Text style={styles.price}>Purchased: ${asset.purchase_price}</Text>}
            </View>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="shield-checkmark-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No assets tracked</Text></View>}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setCreateModal(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}><ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.modal}>
          <Text style={styles.modalTitle}>Track New Asset</Text>
          
          <Text style={styles.label}>Property *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.chipRow}>
            {properties.map(p => (
              <TouchableOpacity key={p.id} style={[styles.chip, form.property_id === p.id && styles.chipActive]} onPress={() => setForm({ ...form, property_id: p.id })}>
                <Text style={[styles.chipText, form.property_id === p.id && { color: '#fff' }]}>{p.nickname || p.name}</Text>
              </TouchableOpacity>
            ))}
          </View></ScrollView>

          <Text style={styles.label}>Asset Name *</Text>
          <TextInput style={styles.input} value={form.name} onChangeText={v => setForm({ ...form, name: v })} placeholder="e.g., Samsung Dishwasher" placeholderTextColor={Colors.grayInactive} />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c} style={[styles.chip, form.category === c && styles.chipActive]} onPress={() => setForm({ ...form, category: c })}>
                <Text style={[styles.chipText, form.category === c && { color: '#fff' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Condition</Text>
          <View style={styles.chipRow}>
            {CONDITIONS.map(c => (
              <TouchableOpacity key={c} style={[styles.chip, form.condition === c && { backgroundColor: COND_COLORS[c], borderColor: COND_COLORS[c] }]} onPress={() => setForm({ ...form, condition: c })}>
                <Text style={[styles.chipText, form.condition === c && { color: '#fff' }]}>{c.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Manufacturer</Text>
          <TextInput style={styles.input} value={form.manufacturer} onChangeText={v => setForm({ ...form, manufacturer: v })} placeholder="Brand" placeholderTextColor={Colors.grayInactive} />

          <Text style={styles.label}>Model / Serial</Text>
          <View style={styles.rowInputs}>
            <TextInput style={[styles.input, { flex: 1 }]} value={form.model_number} onChangeText={v => setForm({ ...form, model_number: v })} placeholder="Model #" placeholderTextColor={Colors.grayInactive} />
            <TextInput style={[styles.input, { flex: 1 }]} value={form.serial_number} onChangeText={v => setForm({ ...form, serial_number: v })} placeholder="Serial #" placeholderTextColor={Colors.grayInactive} />
          </View>

          <Text style={styles.label}>Location in Property</Text>
          <TextInput style={styles.input} value={form.location_in_property} onChangeText={v => setForm({ ...form, location_in_property: v })} placeholder="e.g., Kitchen" placeholderTextColor={Colors.grayInactive} />

          <Text style={styles.label}>Purchase Price</Text>
          <TextInput style={styles.input} value={form.purchase_price} onChangeText={v => setForm({ ...form, purchase_price: v })} keyboardType="numeric" placeholder="$0.00" placeholderTextColor={Colors.grayInactive} />

          <Text style={styles.label}>Warranty Expiry (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={form.warranty_expiry} onChangeText={v => setForm({ ...form, warranty_expiry: v })} placeholder="2027-12-31" placeholderTextColor={Colors.grayInactive} />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={createAsset}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.saveText}>Save</Text></TouchableOpacity>
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
  statNum: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  filterRow: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  filterTextActive: { color: '#fff' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  assetCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  assetHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  assetName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  assetProp: { fontSize: 12, color: Colors.textSecondary },
  assetMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  condBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  condText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  manufacturer: { fontSize: 12, color: Colors.textSecondary },
  modelNum: { fontSize: 11, color: Colors.grayInactive },
  warrantyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.greenReady + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.greenReady + '20' },
  warrantyText: { fontSize: 12, fontWeight: '600' },
  price: { fontSize: 12, color: Colors.textSecondary },
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
  rowInputs: { flexDirection: 'row', gap: Spacing.sm },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: Colors.primary },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
