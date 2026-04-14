import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, RefreshControl, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const SOURCE_COLORS: Record<string, string> = { airbnb: '#FF5A5F', vrbo: '#3B5998', 'booking.com': '#003580', direct: Colors.accent };
const SOURCE_ICONS: Record<string, string> = { airbnb: 'logo-airbnb', vrbo: 'home', 'booking.com': 'globe', direct: 'call' };
const STATUS_COLORS: Record<string, string> = { confirmed: Colors.greenReady, checked_out: Colors.grayInactive, cancelled: Colors.redUrgent };

export default function ReservationsScreen() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncModal, setSyncModal] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [form, setForm] = useState({ property_id: '', guest_name: '', source_system: 'direct', check_in_at: '', check_out_at: '', guest_count: '2', notes: '' });

  const fetchData = useCallback(async () => {
    try {
      const [rRes, sRes] = await Promise.all([api.get('/reservations'), api.get('/reservations/stats')]);
      setReservations(rRes.data);
      setStats(sRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { api.get('/properties').then(r => setProperties(r.data)).catch(() => {}); }, []);

  const triggerSync = async (source: string) => {
    setSyncing(source);
    try {
      const { data } = await api.post('/reservations/sync', { source_system: source });
      Alert.alert('Sync Complete', `${data.synced_count} new reservation(s) from ${source}`);
      fetchData();
    } catch { Alert.alert('Error', 'Sync failed'); }
    finally { setSyncing(null); }
  };

  const createReservation = async () => {
    if (!form.property_id || !form.guest_name) { Alert.alert('Required', 'Select property and enter guest name'); return; }
    try {
      await api.post('/reservations', {
        ...form,
        guest_count: parseInt(form.guest_count) || 2,
      });
      Alert.alert('Created', 'Reservation added');
      setCreateModal(false);
      fetchData();
    } catch { Alert.alert('Error', 'Failed to create'); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Stats Bar */}
      {stats && (
        <View style={styles.statsBar}>
          <View style={styles.stat}><Text style={styles.statNum}>{stats.total}</Text><Text style={styles.statLabel}>Total</Text></View>
          <View style={styles.stat}><Text style={[styles.statNum, { color: Colors.greenReady }]}>{stats.upcoming}</Text><Text style={styles.statLabel}>Upcoming</Text></View>
          {Object.entries(stats.by_source || {}).slice(0, 3).map(([src, count]: [string, any]) => (
            <View key={src} style={styles.stat}><Text style={[styles.statNum, { color: SOURCE_COLORS[src] || Colors.textPrimary }]}>{count}</Text><Text style={styles.statLabel}>{src}</Text></View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.syncBtn} onPress={() => setSyncModal(true)}>
          <Ionicons name="sync" size={18} color={Colors.primary} /><Text style={styles.syncText}>Sync</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => setCreateModal(true)}>
          <Ionicons name="add" size={18} color="#fff" /><Text style={styles.addText}>Add Manual</Text>
        </TouchableOpacity>
      </View>

      {/* Reservations List */}
      <FlatList data={reservations} keyExtractor={r => r.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Colors.primary} />}
        renderItem={({ item: res }) => {
          const srcColor = SOURCE_COLORS[res.source_system] || Colors.grayInactive;
          const statColor = STATUS_COLORS[res.reservation_status] || Colors.grayInactive;
          return (
            <View style={styles.resCard}>
              <View style={[styles.resStripe, { backgroundColor: srcColor }]} />
              <View style={styles.resBody}>
                <View style={styles.resTop}>
                  <View style={[styles.srcBadge, { backgroundColor: srcColor + '15' }]}>
                    <Ionicons name={(SOURCE_ICONS[res.source_system] || 'globe') as any} size={12} color={srcColor} />
                    <Text style={[styles.srcText, { color: srcColor }]}>{res.source_system}</Text>
                  </View>
                  <View style={[styles.statBadge, { backgroundColor: statColor + '15' }]}>
                    <Text style={[styles.statText, { color: statColor }]}>{res.reservation_status}</Text>
                  </View>
                </View>
                <Text style={styles.guestName}>{res.guest_name}</Text>
                <Text style={styles.propName}>{res.property_name}</Text>
                <View style={styles.dateRow}>
                  <View style={styles.dateCol}>
                    <Text style={styles.dateLabel}>Check-in</Text>
                    <Text style={styles.dateVal}>{res.check_in_at ? new Date(res.check_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={Colors.grayInactive} />
                  <View style={styles.dateCol}>
                    <Text style={styles.dateLabel}>Check-out</Text>
                    <Text style={styles.dateVal}>{res.check_out_at ? new Date(res.check_out_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="bed-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No reservations</Text></View>}
      />

      {/* Sync Modal */}
      <Modal visible={syncModal} transparent animationType="fade" onRequestClose={() => setSyncModal(false)}>
        <View style={styles.modalOverlay}><View style={styles.modal}>
          <Text style={styles.modalTitle}>Sync Reservations</Text>
          <Text style={styles.modalSub}>Pull reservations from booking platforms</Text>
          {['airbnb', 'vrbo', 'booking.com'].map(src => (
            <TouchableOpacity key={src} style={styles.syncRow} onPress={() => triggerSync(src)}>
              <Ionicons name={(SOURCE_ICONS[src] || 'globe') as any} size={22} color={SOURCE_COLORS[src]} />
              <Text style={styles.syncName}>{src.charAt(0).toUpperCase() + src.slice(1)}</Text>
              {syncing === src ? <ActivityIndicator color={SOURCE_COLORS[src]} /> : <Ionicons name="cloud-download" size={22} color={SOURCE_COLORS[src]} />}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSyncModal(false)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* Create Modal */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}><ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.modal}>
          <Text style={styles.modalTitle}>Add Reservation</Text>
          <Text style={styles.label}>Property *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.chipRow}>
            {properties.map(p => (
              <TouchableOpacity key={p.id} style={[styles.chip, form.property_id === p.id && styles.chipActive]} onPress={() => setForm({ ...form, property_id: p.id })}>
                <Text style={[styles.chipText, form.property_id === p.id && { color: '#fff' }]}>{p.nickname || p.name}</Text>
              </TouchableOpacity>
            ))}
          </View></ScrollView>
          <Text style={styles.label}>Guest Name *</Text>
          <TextInput style={styles.input} value={form.guest_name} onChangeText={v => setForm({ ...form, guest_name: v })} placeholder="Guest name" placeholderTextColor={Colors.grayInactive} />
          <Text style={styles.label}>Guests</Text>
          <TextInput style={styles.input} value={form.guest_count} onChangeText={v => setForm({ ...form, guest_count: v })} keyboardType="numeric" placeholderTextColor={Colors.grayInactive} />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelActionBtn} onPress={() => setCreateModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveActionBtn} onPress={createReservation}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.saveActionText}>Save</Text></TouchableOpacity>
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
  statsBar: { flexDirection: 'row', backgroundColor: Colors.surface, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md },
  syncBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  syncText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.primary },
  addText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 30 },
  resCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  resStripe: { width: 4 },
  resBody: { flex: 1, padding: Spacing.md, gap: 6 },
  resTop: { flexDirection: 'row', gap: 8 },
  srcBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  srcText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  statBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  guestName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  propName: { fontSize: 13, color: Colors.textSecondary },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 4 },
  dateCol: { alignItems: 'center' },
  dateLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase' },
  dateVal: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalSub: { fontSize: 14, color: Colors.textSecondary },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  syncName: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.textPrimary, textTransform: 'capitalize' },
  closeBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginTop: 8 },
  closeText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginTop: 4 },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  cancelActionBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveActionBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: Colors.primary },
  saveActionText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
