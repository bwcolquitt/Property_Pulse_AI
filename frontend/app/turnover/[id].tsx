import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, StatusColors } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/utils/api';

export default function TurnoverDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [turnover, setTurnover] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isServiceProvider = user?.role === 'cleaner' || user?.role === 'maintenance_technician' || user?.role === 'maintenance';
  const isDueInFuture = turnover?.due_at ? new Date(turnover.due_at) > new Date() : false;
  const isLockedForProvider = isServiceProvider && isDueInFuture;

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/turnovers/${id}`);
        setTurnover(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const handleStatusChange = async (status: string) => {
    try {
      await api.put(`/turnovers/${id}`, { status });
      const { data } = await api.get(`/turnovers/${id}`);
      setTurnover(data);
    } catch (e) { console.error(e); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!turnover) return <View style={styles.loading}><Text>Not found</Text></View>;

  const statusColor = StatusColors[turnover.status] || Colors.grayInactive;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Custom Back Button */}
      <TouchableOpacity testID="custom-back-btn" style={styles.backBtn} onPress={() => {
        if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)'); }
      }}>
        <Ionicons name="arrow-back" size={20} color={Colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* Status and Title */}
      <View style={styles.header}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{(turnover.status || '').replace(/_/g, ' ')}</Text>
        </View>
        <Text style={styles.title}>{turnover.title}</Text>
      </View>

      {/* Property Info */}
      {turnover.property && (
        <TouchableOpacity style={styles.section} onPress={() => router.push(`/property/${turnover.property_id}`)}>
          <View style={styles.sectionHeader}>
            <Ionicons name="home" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>{turnover.property.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.grayInactive} />
          </View>
          <Text style={styles.sectionSubtext}>{turnover.property.address_1}, {turnover.property.city}</Text>
        </TouchableOpacity>
      )}

      {/* Timing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Timing</Text>
        <View style={styles.timingRow}>
          <View style={styles.timingItem}>
            <Text style={styles.timingLabel}>Due</Text>
            <Text style={styles.timingValue}>{turnover.due_at ? new Date(turnover.due_at).toLocaleString() : '--'}</Text>
          </View>
        </View>
        {turnover.reservation && (
          <View style={styles.timingRow}>
            <View style={styles.timingItem}>
              <Text style={styles.timingLabel}>Check-out</Text>
              <Text style={styles.timingValue}>{new Date(turnover.reservation.check_out_at).toLocaleString()}</Text>
            </View>
            <View style={styles.timingItem}>
              <Text style={styles.timingLabel}>Check-in</Text>
              <Text style={styles.timingValue}>{new Date(turnover.reservation.check_in_at).toLocaleString()}</Text>
            </View>
          </View>
        )}
        {turnover.reservation && <Text style={styles.guestName}>Guest: {turnover.reservation.guest_name}</Text>}
      </View>

      {/* Checklist Progress */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Checklist</Text>
          {turnover.checklist && !isLockedForProvider && (
            <TouchableOpacity testID="open-checklist-btn" style={styles.openBtn} onPress={() => router.push(`/checklist/${id}`)}>
              <Text style={styles.openBtnText}>Open Checklist</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        {isLockedForProvider && (
          <View style={styles.lockBanner}>
            <Ionicons name="lock-closed" size={18} color={Colors.redUrgent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lockTitle}>Not available yet</Text>
              <Text style={styles.lockText}>
                This turnover is scheduled for {turnover.due_at ? new Date(turnover.due_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'a future date'}. You can start work on or after the due date.
              </Text>
            </View>
          </View>
        )}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${turnover.checklist?.completion_percent || 0}%` }]} />
          </View>
          <Text style={styles.progressText}>{turnover.checklist?.completion_percent || 0}%</Text>
        </View>
        {turnover.checklist_items?.length > 0 && (
          <Text style={styles.checklistSummary}>
            {turnover.checklist_items.filter((i: any) => i.status === 'completed').length} of {turnover.checklist_items.length} tasks completed
          </Text>
        )}
      </View>

      {/* Linked Issues */}
      {turnover.issues?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Linked Issues ({turnover.issues.length})</Text>
          {turnover.issues.map((issue: any, i: number) => (
            <TouchableOpacity key={i} testID={`linked-issue-${i}`} style={styles.issueRow} onPress={() => router.push(`/issue/${issue.id}`)}>
              <View style={[styles.priorityDot, { backgroundColor: Colors[issue.priority === 'urgent' ? 'redUrgent' : 'yellowAtRisk'] }]} />
              <Text style={styles.issueTitle} numberOfLines={1}>{issue.title}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.grayInactive} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Actions */}
      {!isLockedForProvider && (
      <View style={styles.actionsRow}>
        {turnover.status === 'new' && (
          <TouchableOpacity testID="assign-turnover-btn" style={[styles.actionBtn, { backgroundColor: Colors.blueAssigned }]} onPress={() => handleStatusChange('assigned')}>
            <Ionicons name="person-add" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Assign</Text>
          </TouchableOpacity>
        )}
        {turnover.status === 'assigned' && (
          <TouchableOpacity testID="start-turnover-btn" style={[styles.actionBtn, { backgroundColor: Colors.primary }]} onPress={() => handleStatusChange('in_progress')}>
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Start</Text>
          </TouchableOpacity>
        )}
        {turnover.status === 'in_progress' && (
          <TouchableOpacity testID="ready-inspection-btn" style={[styles.actionBtn, { backgroundColor: Colors.yellowAtRisk }]} onPress={() => handleStatusChange('ready_for_inspection')}>
            <Ionicons name="clipboard" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Ready for Inspection</Text>
          </TouchableOpacity>
        )}
        {turnover.status === 'ready_for_inspection' && (
          <TouchableOpacity testID="complete-turnover-btn" style={[styles.actionBtn, { backgroundColor: Colors.greenReady }]} onPress={() => handleStatusChange('completed')}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Complete</Text>
          </TouchableOpacity>
        )}
      </View>
      )}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 2 },
  backText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  header: { gap: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  section: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  sectionSubtext: { fontSize: 13, color: Colors.textSecondary },
  timingRow: { flexDirection: 'row', gap: Spacing.md },
  timingItem: { flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: 8, padding: Spacing.sm },
  timingLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase' },
  timingValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginTop: 2 },
  guestName: { fontSize: 14, fontWeight: '600', color: Colors.primary, marginTop: 4 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressBar: { flex: 1, height: 8, backgroundColor: Colors.surfaceSecondary, borderRadius: 4 },
  progressFill: { height: 8, backgroundColor: Colors.greenReady, borderRadius: 4 },
  progressText: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  checklistSummary: { fontSize: 13, color: Colors.textSecondary },
  issueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  issueTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 10 },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  lockBanner: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.redUrgent + '08', borderRadius: 10, padding: Spacing.md, borderWidth: 1, borderColor: Colors.redUrgent + '25' },
  lockTitle: { fontSize: 14, fontWeight: '700', color: Colors.redUrgent },
  lockText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginTop: 2 },
});
