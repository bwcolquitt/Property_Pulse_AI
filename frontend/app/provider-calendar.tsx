import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const TYPE_COLORS: Record<string, string> = { cleaning: Colors.purpleAwaiting, maintenance: Colors.primary, pool: Colors.secondary };

export default function ProviderCalendarScreen() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editModal, setEditModal] = useState<any>(null);
  const [editAvailable, setEditAvailable] = useState(true);
  const [editStart, setEditStart] = useState('09:00');
  const [editEnd, setEditEnd] = useState('17:00');
  const [editNotes, setEditNotes] = useState('');

  const fetchData = async () => {
    try {
      const { data } = await api.get('/schedules/provider-availability-bulk', { params: { month: currentMonth } });
      setProviders(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [currentMonth]);

  const saveAvailability = async () => {
    if (!editModal) return;
    try {
      await api.put(`/schedules/provider-availability/${editModal.provider_id}`, {
        date: selectedDate,
        available: editAvailable,
        start_time: editStart,
        end_time: editEnd,
        notes: editNotes,
      });
      setEditModal(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  // Build marked dates from all providers
  const markedDates: any = {};
  providers.forEach(p => {
    (p.availability || []).forEach((a: any) => {
      if (!markedDates[a.date]) markedDates[a.date] = { dots: [] };
      markedDates[a.date].dots.push({
        key: p.provider_id,
        color: a.available ? Colors.greenReady : Colors.redUrgent,
      });
    });
  });
  markedDates[selectedDate] = { ...markedDates[selectedDate], selected: true, selectedColor: Colors.primary + '20', selectedTextColor: Colors.primary };

  const dayAvailability = providers.map(p => {
    const dayData = (p.availability || []).find((a: any) => a.date === selectedDate);
    return { ...p, dayData };
  });

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container}>
      <Calendar
        current={selectedDate}
        onDayPress={(day: any) => setSelectedDate(day.dateString)}
        onMonthChange={(month: any) => setCurrentMonth(month.dateString.slice(0, 7))}
        markingType="multi-dot"
        markedDates={markedDates}
        theme={{
          backgroundColor: Colors.background, calendarBackground: Colors.surface,
          textSectionTitleColor: Colors.textSecondary, selectedDayBackgroundColor: Colors.primary,
          selectedDayTextColor: Colors.primaryForeground, todayTextColor: Colors.primary,
          dayTextColor: Colors.textPrimary, textDisabledColor: Colors.grayInactive,
          arrowColor: Colors.primary, monthTextColor: Colors.textPrimary,
          textDayFontWeight: '500', textMonthFontWeight: '700', textDayHeaderFontWeight: '600',
        }}
        style={styles.calendar}
      />

      <View style={styles.daySection}>
        <Text style={styles.dayTitle}>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <Text style={styles.subtitle}>{providers.length} provider{providers.length !== 1 ? 's' : ''}</Text>

        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.greenReady }]} /><Text style={styles.legendText}>Available</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.redUrgent }]} /><Text style={styles.legendText}>Unavailable</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.grayInactive }]} /><Text style={styles.legendText}>Not Set</Text></View>
        </View>

        {dayAvailability.map((p, i) => {
          const color = TYPE_COLORS[p.provider_type] || Colors.grayInactive;
          const isAvail = p.dayData?.available;
          const statusColor = p.dayData ? (isAvail ? Colors.greenReady : Colors.redUrgent) : Colors.grayInactive;
          return (
            <TouchableOpacity key={i} style={styles.provCard} onPress={() => {
              setEditModal(p);
              setEditAvailable(p.dayData?.available ?? true);
              setEditStart(p.dayData?.start_time || '09:00');
              setEditEnd(p.dayData?.end_time || '17:00');
              setEditNotes(p.dayData?.notes || '');
            }}>
              <View style={[styles.provStripe, { backgroundColor: statusColor }]} />
              <View style={styles.provBody}>
                <View style={styles.provHeader}>
                  <View style={[styles.provIcon, { backgroundColor: color + '15' }]}>
                    <Ionicons name={p.provider_type === 'cleaning' ? 'sparkles' : 'construct'} size={18} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.provName}>{p.company_name}</Text>
                    <Text style={styles.provType}>{p.provider_type}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                    <Ionicons name={isAvail ? 'checkmark-circle' : p.dayData ? 'close-circle' : 'help-circle'} size={14} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{p.dayData ? (isAvail ? 'Available' : 'Busy') : 'Not Set'}</Text>
                  </View>
                </View>
                {p.dayData && isAvail && (
                  <View style={styles.timeRow}>
                    <Ionicons name="time" size={14} color={Colors.textSecondary} />
                    <Text style={styles.timeText}>{p.dayData.start_time || '?'} - {p.dayData.end_time || '?'}</Text>
                  </View>
                )}
                {p.dayData?.notes ? <Text style={styles.provNotes}>{p.dayData.notes}</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })}

        {providers.length === 0 && (
          <View style={styles.empty}><Ionicons name="people" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No active providers</Text></View>
        )}
      </View>

      {/* Edit Modal */}
      <Modal visible={!!editModal} transparent animationType="fade" onRequestClose={() => setEditModal(null)}>
        <View style={styles.modalOverlay}><View style={styles.modal}>
          <Text style={styles.modalTitle}>Set Availability</Text>
          <Text style={styles.modalSub}>{editModal?.company_name} - {selectedDate}</Text>
          
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleBtn, editAvailable && styles.toggleActive]} onPress={() => setEditAvailable(true)}>
              <Ionicons name="checkmark-circle" size={18} color={editAvailable ? '#fff' : Colors.greenReady} />
              <Text style={[styles.toggleText, editAvailable && { color: '#fff' }]}>Available</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, !editAvailable && styles.toggleUnavail]} onPress={() => setEditAvailable(false)}>
              <Ionicons name="close-circle" size={18} color={!editAvailable ? '#fff' : Colors.redUrgent} />
              <Text style={[styles.toggleText, !editAvailable && { color: '#fff' }]}>Unavailable</Text>
            </TouchableOpacity>
          </View>
          
          {editAvailable && (
            <View style={styles.timeInputs}>
              <View style={{ flex: 1 }}><Text style={styles.label}>Start</Text><TextInput style={styles.input} value={editStart} onChangeText={setEditStart} placeholder="09:00" /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>End</Text><TextInput style={styles.input} value={editEnd} onChangeText={setEditEnd} placeholder="17:00" /></View>
            </View>
          )}
          
          <Text style={styles.label}>Notes</Text>
          <TextInput style={styles.input} value={editNotes} onChangeText={setEditNotes} placeholder="Optional notes..." />
          
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={saveAvailability}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.saveText}>Save</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  calendar: { borderRadius: 12, margin: Spacing.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  daySection: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  dayTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary },
  legend: { flexDirection: 'row', gap: Spacing.md, paddingVertical: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: Colors.textSecondary },
  provCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  provStripe: { width: 4 },
  provBody: { flex: 1, padding: Spacing.md, gap: 6 },
  provHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  provIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  provName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  provType: { fontSize: 12, color: Colors.textSecondary, textTransform: 'capitalize' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 12, color: Colors.textSecondary },
  provNotes: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.grayInactive },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
  modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalSub: { fontSize: 14, color: Colors.textSecondary },
  toggleRow: { flexDirection: 'row', gap: Spacing.sm },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  toggleActive: { backgroundColor: Colors.greenReady, borderColor: Colors.greenReady },
  toggleUnavail: { backgroundColor: Colors.redUrgent, borderColor: Colors.redUrgent },
  toggleText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  timeInputs: { flexDirection: 'row', gap: Spacing.sm },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginTop: 4 },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: Colors.primary },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
