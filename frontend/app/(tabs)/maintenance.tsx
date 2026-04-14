import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, StatusColors, PriorityColors } from '../../src/constants/theme';
import api from '../../src/utils/api';

const STATUS_TABS = [
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'awaiting_approval', label: 'Awaiting Approval' },
  { key: 'awaiting_parts', label: 'Awaiting Parts' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'reopened', label: 'Reopened' },
];

export default function MaintenanceScreen() {
  const router = useRouter();
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('outstanding');

  const fetchIssues = useCallback(async () => {
    try {
      const params: any = {};
      if (activeTab === 'outstanding') {
        params.outstanding = true;
      } else if (activeTab === 'unassigned') {
        params.outstanding = true;
        params.unassigned = true;
      } else if (activeTab === 'completed') {
        params.status = 'completed';
        params.outstanding = false;
      } else {
        params.status = activeTab;
        params.outstanding = false;
      }
      const { data } = await api.get('/issues', { params });
      setIssues(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [activeTab]);

  useEffect(() => { setLoading(true); fetchIssues(); }, [fetchIssues]);

  const renderIssue = ({ item }: { item: any }) => (
    <TouchableOpacity testID={`issue-card-${item.id}`} style={styles.card} onPress={() => router.push(`/issue/${item.id}`)}>
      <View style={styles.cardTop}>
        <View style={[styles.priorityTag, { backgroundColor: (PriorityColors[item.priority] || Colors.grayInactive) + '15' }]}>
          <Text style={[styles.priorityText, { color: PriorityColors[item.priority] || Colors.grayInactive }]}>{item.priority}</Text>
        </View>
        <View style={[styles.statusTag, { backgroundColor: (StatusColors[item.status] || Colors.grayInactive) + '15' }]}>
          <Text style={[styles.statusTagText, { color: StatusColors[item.status] || Colors.grayInactive }]}>{(item.status || '').replace(/_/g, ' ')}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
      <View style={styles.cardRow}>
        <Ionicons name="home-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.cardMeta} numberOfLines={1}>{item.property_name || 'Unknown'}</Text>
      </View>
      <View style={styles.cardRow}>
        <Ionicons name="construct-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.cardMeta}>{item.trade_type} · {item.location_in_property || 'General'}</Text>
      </View>
      <View style={styles.cardBottom}>
        <View style={styles.cardRow}>
          <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.cardMeta}>{item.assigned_name}</Text>
        </View>
        <View style={styles.badges}>
          {item.blocks_check_in && (
            <View style={styles.blocksBadge}><Ionicons name="ban" size={12} color={Colors.redUrgent} /><Text style={styles.blocksText}>Blocks</Text></View>
          )}
          {item.guest_impact_level === 'high' && (
            <View style={styles.guestBadge}><Ionicons name="people" size={12} color={Colors.accent} /><Text style={styles.guestText}>Guest Impact</Text></View>
          )}
          {item.photo_count > 0 && (
            <View style={styles.photoBadge}><Ionicons name="camera" size={12} color={Colors.blueAssigned} /><Text style={styles.photoText}>{item.photo_count}</Text></View>
          )}
        </View>
      </View>
      {item.due_at && (
        <View style={styles.dueRow}>
          <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
          <Text style={styles.dueText}>Due: {new Date(item.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
          {item.next_check_in_at && <Text style={styles.checkinText}>Check-in: {new Date(item.next_check_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text>}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Status tabs */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={STATUS_TABS}
        keyExtractor={t => t.key}
        contentContainerStyle={styles.tabRow}
        renderItem={({ item: t }) => (
          <TouchableOpacity testID={`tab-${t.key}`} style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key)}>
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={issues}
          keyExtractor={item => item.id}
          renderItem={renderIssue}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchIssues(); }} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.greenReady} />
              <Text style={styles.emptyTitle}>All clear!</Text>
              <Text style={styles.emptyText}>No issues in this category</Text>
            </View>
          }
          ListHeaderComponent={
            <View style={styles.countHeader}>
              <Text style={styles.countText}>{issues.length} issue{issues.length !== 1 ? 's' : ''}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primaryForeground },
  countHeader: { paddingHorizontal: 4, paddingBottom: Spacing.sm },
  countText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 30 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  cardTop: { flexDirection: 'row', gap: Spacing.sm },
  priorityTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  priorityText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  statusTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  statusTagText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardMeta: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  badges: { flexDirection: 'row', gap: 6 },
  blocksBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.redUrgent + '12', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  blocksText: { fontSize: 10, fontWeight: '700', color: Colors.redUrgent },
  guestBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.accent + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  guestText: { fontSize: 10, fontWeight: '700', color: Colors.accent },
  photoBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.blueAssigned + '12', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  photoText: { fontSize: 10, fontWeight: '700', color: Colors.blueAssigned },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.border },
  dueText: { fontSize: 12, fontWeight: '600', color: Colors.accent },
  checkinText: { fontSize: 12, color: Colors.textSecondary, marginLeft: 'auto' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
});
