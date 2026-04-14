import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, StatusColors } from '../../src/constants/theme';
import api from '../../src/utils/api';

export default function TurnoversScreen() {
  const router = useRouter();
  const [turnovers, setTurnovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const filters = ['all', 'new', 'assigned', 'in_progress', 'ready_for_inspection', 'completed'];

  const fetchTurnovers = useCallback(async () => {
    try {
      const params: any = {};
      if (filter !== 'all') params.status = filter;
      const { data } = await api.get('/turnovers', { params });
      setTurnovers(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { fetchTurnovers(); }, [fetchTurnovers]);

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => StatusColors[status] || Colors.grayInactive;

  const renderTurnover = ({ item }: { item: any }) => (
    <TouchableOpacity testID={`turnover-card-${item.id}`} style={styles.card} onPress={() => router.push(`/turnover/${item.id}`)}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{(item.status || '').replace(/_/g, ' ')}</Text>
        </View>
        {item.risk_level === 'at_risk' && (
          <View style={styles.riskBadge}><Ionicons name="warning" size={14} color={Colors.yellowAtRisk} /><Text style={styles.riskText}>At Risk</Text></View>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{item.title || item.property_name}</Text>
      <Text style={styles.cardSubtitle}>{item.property_name} · {item.property_address}</Text>
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.metaText}>Due: {formatTime(item.due_at)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{item.assigned_name}</Text>
        </View>
      </View>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${item.checklist_progress || 0}%` }]} />
        </View>
        <Text style={styles.progressText}>{item.checklist_progress || 0}%</Text>
      </View>
      {item.issues_count > 0 && (
        <View style={styles.issuesBadge}>
          <Ionicons name="alert-circle" size={14} color={Colors.redUrgent} />
          <Text style={styles.issuesBadgeText}>{item.issues_count} issue{item.issues_count > 1 ? 's' : ''}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Filters */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={filters}
        keyExtractor={f => f}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: f }) => (
          <TouchableOpacity testID={`filter-${f}`} style={[styles.filterBtn, filter === f && styles.filterBtnActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f === 'all' ? 'All' : f.replace(/_/g, ' ')}</Text>
          </TouchableOpacity>
        )}
      />
      <FlatList
        data={turnovers}
        keyExtractor={item => item.id}
        renderItem={renderTurnover}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTurnovers(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="calendar-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No turnovers found</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  filterTextActive: { color: Colors.primaryForeground },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 30 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.yellowAtRisk + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  riskText: { fontSize: 11, fontWeight: '700', color: Colors.yellowAtRisk },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: Colors.textSecondary },
  cardMeta: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  progressBar: { flex: 1, height: 6, backgroundColor: Colors.surfaceSecondary, borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: Colors.greenReady, borderRadius: 3 },
  progressText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, width: 35 },
  issuesBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.redUrgent + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  issuesBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.redUrgent },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
});
