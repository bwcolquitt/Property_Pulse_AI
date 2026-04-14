import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { Colors, Spacing, StatusColors } from '../src/constants/theme';
import api from '../src/utils/api';

const SVC_COLORS: Record<string, string> = { cleaning: Colors.purpleAwaiting, maintenance: Colors.primary, pool: Colors.secondary, electrical: Colors.accent };
const SVC_ICONS: Record<string, string> = { cleaning: 'sparkles', maintenance: 'construct', pool: 'water', electrical: 'flash' };

export default function CalendarScreen() {
  const router = useRouter();
  const [turnovers, setTurnovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignModal, setAssignModal] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/admin/calendar');
        setTurnovers(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const loadProviders = async (serviceType: string) => {
    try {
      const { data } = await api.get('/marketplace/providers', { params: { service_type: serviceType === 'cleaning' ? 'cleaning' : 'maintenance' } });
      setProviders(data);
    } catch { setProviders([]); }
  };

  const assignService = async (turnover: any, serviceType: string, providerId?: string) => {
    try {
      await api.post('/admin/assign-service', {
        turnover_id: turnover.id,
        service_type: serviceType,
        provider_id: providerId,
        scheduled_at: turnover.due_at,
      });
      setAssignModal(null);
      // Refresh
      const { data } = await api.get('/admin/calendar');
      setTurnovers(data);
    } catch {}
  };

  // Build marked dates
  const markedDates: any = {};
  turnovers.forEach(t => {
    if (t.due_at) {
      const date = t.due_at.split('T')[0];
      const color = StatusColors[t.status] || Colors.blueAssigned;
      if (!markedDates[date]) markedDates[date] = { dots: [], marked: true };
      markedDates[date].dots.push({ key: t.id, color });
    }
  });
  markedDates[selectedDate] = { ...markedDates[selectedDate], selected: true, selectedColor: Colors.primary + '20', selectedTextColor: Colors.primary };

  const dayTurnovers = turnovers.filter(t => t.due_at && t.due_at.split('T')[0] === selectedDate);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container}>
      <Calendar
        testID="turnover-calendar"
        current={selectedDate}
        onDayPress={(day: any) => setSelectedDate(day.dateString)}
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
        <Text style={styles.dayCount}>{dayTurnovers.length} checkout{dayTurnovers.length !== 1 ? 's' : ''}</Text>

        {dayTurnovers.length === 0 && (
          <View style={styles.empty}><Ionicons name="calendar-outline" size={32} color={Colors.grayInactive} /><Text style={styles.emptyText}>No checkouts scheduled</Text></View>
        )}

        {dayTurnovers.map((t, i) => {
          const color = StatusColors[t.status] || Colors.grayInactive;
          const assigns = t.service_assignments || [];
          return (
            <View key={i} style={styles.card}>
              <View style={[styles.cardStripe, { backgroundColor: color }]} />
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={[styles.badge, { backgroundColor: color + '15' }]}>
                    <Text style={[styles.badgeText, { color }]}>{(t.status || '').replace(/_/g, ' ')}</Text>
                  </View>
                  <Text style={styles.timeText}>{t.due_at ? new Date(t.due_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => router.push(`/turnover/${t.id}`)}>
                  <Text style={styles.cardTitle}>{t.property_name || t.title}</Text>
                </TouchableOpacity>
                <Text style={styles.cardAddr}>{t.property_address}</Text>
                <View style={styles.assignedRow}>
                  <Ionicons name="person" size={14} color={Colors.textSecondary} />
                  <Text style={styles.assignedText}>{t.assigned_name || 'Unassigned'}</Text>
                </View>

                {/* Service Assignments */}
                <View style={styles.servicesSection}>
                  <Text style={styles.servicesLabel}>Services</Text>
                  <View style={styles.svcRow}>
                    {['cleaning', 'maintenance', 'pool'].map(svc => {
                      const assigned = assigns.find((a: any) => a.service_type === svc);
                      return (
                        <TouchableOpacity key={svc} testID={`assign-${svc}-${t.id}`} style={[styles.svcChip, assigned && { backgroundColor: (SVC_COLORS[svc] || Colors.grayInactive) + '18', borderColor: SVC_COLORS[svc] || Colors.grayInactive }]}
                          onPress={() => { setAssignModal({ turnover: t, serviceType: svc }); loadProviders(svc); }}>
                          <Ionicons name={(SVC_ICONS[svc] || 'construct') as any} size={14} color={assigned ? SVC_COLORS[svc] : Colors.grayInactive} />
                          <Text style={[styles.svcText, assigned && { color: SVC_COLORS[svc] }]}>{svc}</Text>
                          {assigned ? <Ionicons name="checkmark-circle" size={14} color={SVC_COLORS[svc]} /> : <Ionicons name="add-circle-outline" size={14} color={Colors.grayInactive} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Assign Service Modal */}
      <Modal visible={!!assignModal} transparent animationType="fade" onRequestClose={() => setAssignModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Assign {assignModal?.serviceType} service</Text>
            <Text style={styles.modalProp}>{assignModal?.turnover?.property_name}</Text>
            <FlatList
              data={providers}
              keyExtractor={p => p.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item: p }) => (
                <TouchableOpacity testID={`select-provider-${p.id}`} style={styles.providerRow} onPress={() => assignService(assignModal.turnover, assignModal.serviceType, p.id)}>
                  <View style={styles.provAvatar}><Ionicons name="person" size={18} color={Colors.primary} /></View>
                  <View style={{flex: 1}}><Text style={styles.provName}>{p.company_name}</Text><Text style={styles.provMeta}>Rating: {p.base_rating} · Response: {p.response_rate}%</Text></View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.grayInactive} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.noProviders}>No providers found</Text>}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setAssignModal(null)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  calendar: { borderRadius: 12, margin: Spacing.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  daySection: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 30 },
  dayTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  dayCount: { fontSize: 13, color: Colors.textSecondary },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.grayInactive },
  card: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  cardStripe: { width: 4 },
  cardContent: { flex: 1, padding: Spacing.md, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  timeText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  cardAddr: { fontSize: 12, color: Colors.textSecondary },
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  assignedText: { fontSize: 12, color: Colors.textSecondary },
  servicesSection: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.border },
  servicesLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 6 },
  svcRow: { flexDirection: 'row', gap: 8 },
  svcChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  svcText: { fontSize: 11, fontWeight: '600', color: Colors.grayInactive, textTransform: 'capitalize' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
  modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textTransform: 'capitalize' },
  modalProp: { fontSize: 14, color: Colors.textSecondary },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  provAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  provName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  provMeta: { fontSize: 11, color: Colors.textSecondary },
  noProviders: { textAlign: 'center', paddingVertical: 20, color: Colors.grayInactive },
  modalClose: { paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginTop: 8 },
  modalCloseText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
});
