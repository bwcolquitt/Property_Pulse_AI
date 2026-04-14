import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly'];
const TYPES = ['cleaning', 'maintenance', 'pool', 'deep_clean', 'safety_check'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const typeColors: Record<string, string> = { cleaning: Colors.purpleAwaiting, maintenance: Colors.primary, pool: Colors.secondary, deep_clean: Colors.accent, safety_check: Colors.redUrgent };

export default function RecurringSchedulesScreen() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState({ property_id: '', schedule_type: 'cleaning', frequency: 'weekly', day_of_week: 1, preferred_time: '10:00', notes: '' });

  const fetch = async () => {
    try {
      const [sRes, pRes] = await Promise.all([api.get('/schedules/recurring'), api.get('/properties')]);
      setSchedules(sRes.data);
      setProperties(pRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const create = async () => {
    if (!form.property_id) { Alert.alert('Required', 'Select a property'); return; }
    try {
      await api.post('/schedules/recurring', form);
      Alert.alert('Created', 'Recurring schedule added');
      setCreateModal(false);
      fetch();
    } catch (e) { Alert.alert('Error', 'Failed'); }
  };

  const remove = (id: string) => {
    Alert.alert('Delete Schedule', 'Remove this recurring schedule?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/schedules/recurring/${id}`); fetch(); } },
    ]);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{flex: 1}}><Text style={styles.title}>Recurring Schedules</Text><Text style={styles.subtitle}>{schedules.length} active schedule{schedules.length !== 1 ? 's' : ''}</Text></View>
        <TouchableOpacity testID="add-recurring" style={styles.addBtn} onPress={() => setCreateModal(true)}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={schedules}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: s }) => {
          const color = typeColors[s.schedule_type] || Colors.grayInactive;
          return (
            <View testID={`sched-${s.id}`} style={styles.card}>
              <View style={[styles.typeStripe, { backgroundColor: color }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <View style={[styles.typeBadge, { backgroundColor: color + '15' }]}>
                    <Text style={[styles.typeText, { color }]}>{s.schedule_type.replace(/_/g, ' ')}</Text>
                  </View>
                  <Text style={styles.freqText}>{s.frequency}</Text>
                  <TouchableOpacity onPress={() => remove(s.id)}><Ionicons name="trash-outline" size={18} color={Colors.redUrgent} /></TouchableOpacity>
                </View>
                <Text style={styles.propName}>{s.property_name}</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="time" size={14} color={Colors.textSecondary} />
                  <Text style={styles.detailText}>{s.preferred_time} · {s.day_of_week !== null && s.day_of_week !== undefined ? DAYS[s.day_of_week] : 'Any day'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={14} color={Colors.textSecondary} />
                  <Text style={styles.detailText}>{s.provider_name}</Text>
                </View>
                {s.notes ? <Text style={styles.notes}>{s.notes}</Text> : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="repeat" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No recurring schedules</Text><Text style={styles.emptyHint}>Tap + to create one</Text></View>}
      />

      {/* Create Modal */}
      <Modal visible={createModal} transparent animationType="fade" onRequestClose={() => setCreateModal(false)}>
        <View style={styles.modalOverlay}><View style={styles.modal}>
          <Text style={styles.modalTitle}>New Recurring Schedule</Text>

          <Text style={styles.label}>Property</Text>
          <View style={styles.chipRow}>
            {properties.map(p => (
              <TouchableOpacity key={p.id} style={[styles.chip, form.property_id === p.id && styles.chipActive]} onPress={() => setForm({ ...form, property_id: p.id })}>
                <Text style={[styles.chipText, form.property_id === p.id && styles.chipTextActive]}>{p.nickname || p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Service Type</Text>
          <View style={styles.chipRow}>
            {TYPES.map(t => (
              <TouchableOpacity key={t} style={[styles.chip, form.schedule_type === t && { backgroundColor: typeColors[t], borderColor: typeColors[t] }]} onPress={() => setForm({ ...form, schedule_type: t })}>
                <Text style={[styles.chipText, form.schedule_type === t && { color: '#fff' }]}>{t.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Frequency</Text>
          <View style={styles.chipRow}>
            {FREQUENCIES.map(f => (
              <TouchableOpacity key={f} style={[styles.chip, form.frequency === f && styles.chipActive]} onPress={() => setForm({ ...form, frequency: f })}>
                <Text style={[styles.chipText, form.frequency === f && styles.chipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Preferred Day</Text>
          <View style={styles.chipRow}>
            {DAYS.map((d, i) => (
              <TouchableOpacity key={i} style={[styles.dayChip, form.day_of_week === i && styles.dayActive]} onPress={() => setForm({ ...form, day_of_week: i })}>
                <Text style={[styles.dayText, form.day_of_week === i && { color: '#fff' }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Preferred Time</Text>
          <TextInput style={styles.timeInput} value={form.preferred_time} onChangeText={v => setForm({ ...form, preferred_time: v })} placeholder="10:00" />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity testID="save-recurring" style={styles.saveBtn} onPress={create}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.saveText}>Create</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 12, color: Colors.textSecondary },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 30 },
  card: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  typeStripe: { width: 4 },
  cardBody: { flex: 1, padding: Spacing.md, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  freqText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  propName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: Colors.textSecondary },
  notes: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic' },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  emptyText: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyHint: { fontSize: 14, color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.md },
  modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  dayChip: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  dayActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  timeInput: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontWeight: '600', borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: Colors.primary },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
