import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/constants/theme';
import api from '../../src/utils/api';

const PRIO_COLORS: Record<string, string> = { urgent: Colors.redUrgent, high: Colors.accent, normal: Colors.yellowAtRisk, low: Colors.grayInactive };
const STATUS_COLORS: Record<string, string> = { new: Colors.blueAssigned, not_started: Colors.blueAssigned, assigned: Colors.blueAssigned, in_progress: Colors.accent, blocked: Colors.redUrgent, awaiting_parts: Colors.yellowAtRisk, scheduled: Colors.purpleAwaiting };
const FILTER_TABS = ['all', 'urgent', 'high', 'not_started', 'in_progress', 'blocked'];

export default function MaintenanceTab() {
  const [issues, setIssues] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const params: any = {};
      if (filter === 'urgent' || filter === 'high') params.priority = filter;
      const [iRes, sRes] = await Promise.all([api.get('/maintenance-hub/outstanding', { params }), api.get('/maintenance-hub/stats')]);
      let data = iRes.data;
      if (filter === 'not_started') data = data.filter((i: any) => ['new', 'not_started'].includes(i.status));
      if (filter === 'in_progress') data = data.filter((i: any) => i.status === 'in_progress');
      if (filter === 'blocked') data = data.filter((i: any) => i.status === 'blocked');
      setIssues(data);
      setStats(sRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (id: string) => {
    try { const { data } = await api.get(`/maintenance-hub/${id}`); setDetail(data); } catch {}
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Stats Bar */}
      {stats && (
        <View style={styles.statsBar}>
          <View style={[styles.stat, { borderColor: Colors.redUrgent }]}><Text style={[styles.statNum, { color: Colors.redUrgent }]}>{stats.urgent}</Text><Text style={styles.statLabel}>Urgent</Text></View>
          <View style={styles.stat}><Text style={[styles.statNum, { color: Colors.accent }]}>{stats.high}</Text><Text style={styles.statLabel}>High</Text></View>
          <View style={styles.stat}><Text style={[styles.statNum, { color: Colors.blueAssigned }]}>{stats.not_started}</Text><Text style={styles.statLabel}>Not Started</Text></View>
          <View style={styles.stat}><Text style={[styles.statNum, { color: Colors.yellowAtRisk }]}>{stats.in_progress}</Text><Text style={styles.statLabel}>In Progress</Text></View>
          <View style={styles.stat}><Text style={[styles.statNum, { color: Colors.redUrgent }]}>{stats.blocked}</Text><Text style={styles.statLabel}>Blocked</Text></View>
        </View>
      )}

      {/* Filter Tabs */}
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={FILTER_TABS} keyExtractor={f => f} contentContainerStyle={styles.filterRow}
        renderItem={({ item: f }) => (
          <TouchableOpacity style={[styles.filterBtn, filter === f && styles.filterActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f === 'all' ? 'All Open' : f === 'not_started' ? 'Not Started' : f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Issues List */}
      <FlatList data={issues} keyExtractor={i => i.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Colors.primary} />}
        renderItem={({ item: issue }) => {
          const prioColor = PRIO_COLORS[issue.priority] || Colors.grayInactive;
          const statColor = STATUS_COLORS[issue.status] || Colors.grayInactive;
          return (
            <TouchableOpacity style={styles.issueCard} onPress={() => openDetail(issue.id)}>
              <View style={[styles.prioBar, { backgroundColor: prioColor }]} />
              <View style={styles.issueBody}>
                <View style={styles.issueTop}>
                  <View style={[styles.badge, { backgroundColor: prioColor + '15' }]}><Text style={[styles.badgeText, { color: prioColor }]}>{issue.priority}</Text></View>
                  <View style={[styles.badge, { backgroundColor: statColor + '15' }]}><Text style={[styles.badgeText, { color: statColor }]}>{issue.status?.replace(/_/g, ' ')}</Text></View>
                </View>
                <Text style={styles.issueTitle}>{issue.title}</Text>
                <Text style={styles.issueProp}>{issue.property_name}</Text>
                {issue.description ? <Text style={styles.issueDesc} numberOfLines={2}>{issue.description}</Text> : null}
                <View style={styles.issueMeta}>
                  {issue.trade_type && <Text style={styles.trade}>{issue.trade_type}</Text>}
                  {issue.estimate_amount > 0 && <Text style={styles.estimate}>${issue.estimate_amount}</Text>}
                  {issue.photos?.length > 0 && <View style={styles.photoCount}><Ionicons name="camera" size={12} color={Colors.blueAssigned} /><Text style={styles.photoCountText}>{issue.photos.length}</Text></View>}
                </View>
                {/* Recurring / Still Exists badge */}
                {issue.title?.startsWith('[RECURRING]') && (
                  <View style={styles.recurringBadge}><Ionicons name="repeat" size={12} color={Colors.redUrgent} /><Text style={styles.recurringText}>Recurring Issue</Text></View>
                )}
                <TouchableOpacity style={styles.stillExistsBtn} onPress={() => {
                  Alert.alert('Still Exists?', `Confirm "${issue.title}" is still an open problem?`, [
                    { text: 'Cancel' },
                    { text: 'Still Exists', style: 'destructive', onPress: async () => {
                      try {
                        await api.post('/issues-v2/quick-report', {
                          property_id: issue.property_id,
                          title: issue.title?.startsWith('[RECURRING]') ? issue.title : `[RECURRING] ${issue.title}`,
                          description: `Still exists as of ${new Date().toLocaleDateString()}. Original: ${issue.description || ''}`,
                          priority: 'high',
                        });
                        Alert.alert('Flagged', 'Marked as still existing. Admin notified for permanent fix.');
                        fetchData();
                      } catch { Alert.alert('Error', 'Failed'); }
                    }},
                  ]);
                }}>
                  <Ionicons name="repeat" size={13} color={Colors.redUrgent} />
                  <Text style={styles.stillExistsText}>Still Exists</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="checkmark-done-circle" size={56} color={Colors.greenReady} /><Text style={styles.emptyTitle}>All Clear!</Text><Text style={styles.emptyText}>No outstanding maintenance tasks</Text></View>}
      />

      {/* Detail Modal */}
      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalOverlay}><ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.modal}>
          {detail && (<>
            <View style={styles.detailHeader}>
              <View style={[styles.prioBar, { backgroundColor: PRIO_COLORS[detail.priority] || Colors.grayInactive, height: 40, width: 5, borderRadius: 3 }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.detailTitle}>{detail.title}</Text>
                <Text style={styles.detailProp}>{detail.property_name}</Text>
              </View>
            </View>
            {detail.description ? <Text style={styles.detailDesc}>{detail.description}</Text> : null}
            <View style={styles.detailMeta}>
              <View style={[styles.badge, { backgroundColor: (PRIO_COLORS[detail.priority] || Colors.grayInactive) + '15' }]}><Text style={[styles.badgeText, { color: PRIO_COLORS[detail.priority] || Colors.grayInactive }]}>{detail.priority}</Text></View>
              <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[detail.status] || Colors.grayInactive) + '15' }]}><Text style={[styles.badgeText, { color: STATUS_COLORS[detail.status] || Colors.grayInactive }]}>{detail.status?.replace(/_/g, ' ')}</Text></View>
              {detail.trade_type && <View style={styles.badge}><Text style={styles.badgeText}>{detail.trade_type}</Text></View>}
              {detail.estimate_amount > 0 && <Text style={styles.estAmount}>${detail.estimate_amount}</Text>}
            </View>
            {detail.photos?.length > 0 && <Text style={styles.sectionLabel}>Photos ({detail.photos.length})</Text>}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setDetail(null)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
          </>)}
        </View></ScrollView></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  statsBar: { flexDirection: 'row', backgroundColor: Colors.surface, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border, justifyContent: 'space-around' },
  stat: { alignItems: 'center', flex: 1, paddingVertical: 4, borderRadius: 8 },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 30 },
  issueCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  prioBar: { width: 4 },
  issueBody: { flex: 1, padding: Spacing.md, gap: 4 },
  issueTop: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  issueTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  issueProp: { fontSize: 12, color: Colors.textSecondary },
  issueDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  issueMeta: { flexDirection: 'row', gap: Spacing.md, marginTop: 2 },
  trade: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  estimate: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  photoCount: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  photoCountText: { fontSize: 11, fontWeight: '600', color: Colors.blueAssigned },
  recurringBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: Colors.redUrgent + '10', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  recurringText: { fontSize: 10, fontWeight: '700', color: Colors.redUrgent },
  stillExistsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: Colors.redUrgent + '40', backgroundColor: Colors.redUrgent + '06', marginTop: 4 },
  stillExistsText: { fontSize: 11, fontWeight: '700', color: Colors.redUrgent },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.greenReady },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '90%' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  detailProp: { fontSize: 13, color: Colors.textSecondary },
  detailDesc: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  detailMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  estAmount: { fontSize: 14, fontWeight: '700', color: Colors.accent },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginTop: 8 },
  closeBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.sm },
  closeText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
});
