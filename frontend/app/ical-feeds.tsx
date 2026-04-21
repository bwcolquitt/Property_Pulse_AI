import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function IcalFeedsScreen() {
  const [feeds, setFeeds] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ property_id: '', label: 'Airbnb', url: '', enabled: true });
  const [syncingAll, setSyncingAll] = useState(false);

  const load = async () => {
    try {
      const [f, p] = await Promise.all([api.get('/ical/feeds'), api.get('/properties')]);
      setFeeds(f.data);
      setProperties(p.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addFeed = async () => {
    if (!form.property_id || !form.url) { Alert.alert('Required', 'Select property and paste iCal URL'); return; }
    try {
      await api.post('/ical/feeds', form);
      Alert.alert('Added', 'iCal feed added. Tap Sync to import reservations.');
      setAddModal(false);
      setForm({ property_id: '', label: 'Airbnb', url: '', enabled: true });
      load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
  };

  const syncFeed = async (id: string) => {
    try {
      const { data } = await api.post(`/ical/feeds/${id}/sync`);
      Alert.alert('Synced', data.message || `Imported ${data.imported} reservations`);
      load();
    } catch (e: any) { Alert.alert('Sync Failed', e.response?.data?.detail || 'Error'); }
  };

  const syncAll = async () => {
    setSyncingAll(true);
    try {
      const { data } = await api.post('/ical/sync-all');
      Alert.alert('All Synced', `${data.imported} imported, ${data.skipped} skipped${data.errors?.length ? `, ${data.errors.length} errors` : ''}`);
      load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
    finally { setSyncingAll(false); }
  };

  const removeFeed = (id: string, label: string) => {
    Alert.alert('Remove feed?', `Stop syncing "${label}"?`, [
      { text: 'Cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await api.delete(`/ical/feeds/${id}`); load(); } },
    ]);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>iCal Feeds</Text>
        <Text style={styles.subtitle}>Paste any Airbnb, Vrbo, Booking.com, or PMS iCal URL to auto-sync reservations. No API keys needed.</Text>

        <View style={styles.tipCard}>
          <Ionicons name="bulb" size={18} color={Colors.primary} />
          <Text style={styles.tipText}>Where to find iCal URL: <Text style={styles.tipBold}>Airbnb</Text> → Listing → Availability → Sync Calendars. <Text style={styles.tipBold}>Vrbo</Text> → Calendar → Import/Export. Most PMS: Calendar Settings → iCal Export.</Text>
        </View>

        {feeds.length === 0 ? (
          <View style={styles.empty}><Ionicons name="calendar-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No iCal feeds configured</Text><Text style={styles.emptyHint}>Tap + to add your first feed</Text></View>
        ) : (
          feeds.map(f => (
            <View key={f.id} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <View style={styles.labelRow}><Ionicons name="calendar" size={16} color={Colors.primary} /><Text style={styles.label}>{f.label}</Text>{f.enabled && <View style={styles.activeBadge}><Text style={styles.activeText}>ACTIVE</Text></View>}</View>
                  <Text style={styles.property}>{f.property_name || 'Unknown property'}</Text>
                  <Text style={styles.url} numberOfLines={1}>{f.url}</Text>
                  {f.last_sync_at ? <Text style={styles.meta}>Last sync: {new Date(f.last_sync_at).toLocaleString()} · {f.last_sync_count || 0} imported</Text> : <Text style={styles.meta}>Not synced yet</Text>}
                  {f.last_error ? <Text style={styles.errText}>⚠ {f.last_error}</Text> : null}
                </View>
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.syncBtn} onPress={() => syncFeed(f.id)}><Ionicons name="sync" size={14} color="#fff" /><Text style={styles.syncText}>Sync</Text></TouchableOpacity>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeFeed(f.id, f.label)}><Ionicons name="trash" size={14} color={Colors.redUrgent} /><Text style={styles.removeText}>Remove</Text></TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {feeds.length > 0 && (
          <TouchableOpacity style={styles.syncAllBtn} onPress={syncAll} disabled={syncingAll}>
            {syncingAll ? <ActivityIndicator color="#fff" /> : <><Ionicons name="refresh-circle" size={20} color="#fff" /><Text style={styles.syncAllText}>Sync All Feeds</Text></>}
          </TouchableOpacity>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setAddModal(true)}><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity>

      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}><ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.modal}>
          <Text style={styles.modalTitle}>Add iCal Feed</Text>
          <Text style={styles.mLabel}>Property</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.chipRow}>
            {properties.map(p => (
              <TouchableOpacity key={p.id} style={[styles.chip, form.property_id === p.id && styles.chipActive]} onPress={() => setForm({ ...form, property_id: p.id })}>
                <Text style={[styles.chipText, form.property_id === p.id && { color: '#fff' }]}>{p.nickname || p.name}</Text>
              </TouchableOpacity>
            ))}
          </View></ScrollView>

          <Text style={styles.mLabel}>Label / Source</Text>
          <View style={styles.chipRow}>{['Airbnb', 'Vrbo', 'Booking.com', 'Hostaway', 'Lodgify', 'Other'].map(x => (
            <TouchableOpacity key={x} style={[styles.chip, form.label === x && styles.chipActive]} onPress={() => setForm({ ...form, label: x })}>
              <Text style={[styles.chipText, form.label === x && { color: '#fff' }]}>{x}</Text>
            </TouchableOpacity>
          ))}</View>

          <Text style={styles.mLabel}>iCal URL</Text>
          <TextInput style={[styles.input, { height: 80 }]} multiline value={form.url} onChangeText={v => setForm({ ...form, url: v.trim() })} placeholder="https://www.airbnb.com/calendar/ical/...ics" autoCapitalize="none" placeholderTextColor={Colors.grayInactive} />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={addFeed}><Ionicons name="add" size={16} color="#fff" /><Text style={styles.saveText}>Add Feed</Text></TouchableOpacity>
          </View>
        </View></ScrollView></View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary },
  tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.primary + '08', padding: Spacing.md, borderRadius: 10, borderWidth: 1, borderColor: Colors.primary + '25' },
  tipText: { flex: 1, fontSize: 12, color: Colors.primary, lineHeight: 16 },
  tipBold: { fontWeight: '800' },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  cardHead: { flexDirection: 'row', gap: Spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  activeBadge: { backgroundColor: Colors.greenReady + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  activeText: { fontSize: 9, fontWeight: '800', color: Colors.greenReady },
  property: { fontSize: 13, color: Colors.textPrimary, marginTop: 2 },
  url: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  meta: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  errText: { fontSize: 11, color: Colors.redUrgent, marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm },
  syncBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.primary },
  syncText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.redUrgent },
  removeText: { fontSize: 12, fontWeight: '700', color: Colors.redUrgent },
  syncAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 10, backgroundColor: Colors.accent, marginTop: 8 },
  syncAllText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  emptyHint: { fontSize: 13, color: Colors.grayInactive },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  mLabel: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase', marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: Colors.primary },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
