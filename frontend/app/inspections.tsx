import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, StatusColors } from '../src/constants/theme';
import api from '../src/utils/api';

export default function InspectionsScreen() {
  const router = useRouter();
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetch = async () => {
    try {
      const params: any = {};
      if (filter !== 'all') params.status = filter;
      const { data } = await api.get('/inspections', { params });
      setInspections(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [filter]);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={['all', 'pending', 'in_progress', 'passed', 'failed', 'reclean_requested']}
        keyExtractor={f => f}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: f }) => (
          <TouchableOpacity testID={`filter-${f}`} style={[styles.filterBtn, filter === f && styles.filterActive]} onPress={() => { setFilter(f); setLoading(true); }}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f === 'all' ? 'All' : f.replace(/_/g, ' ')}</Text>
          </TouchableOpacity>
        )}
      />
      <FlatList
        data={inspections}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={fetch} tintColor={Colors.primary} />}
        renderItem={({ item: insp }) => {
          const color = StatusColors[insp.status] || Colors.grayInactive;
          return (
            <TouchableOpacity testID={`inspection-${insp.id}`} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.badge, { backgroundColor: color + '15' }]}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={[styles.badgeText, { color }]}>{(insp.status || '').replace(/_/g, ' ')}</Text>
                </View>
                {insp.score !== null && (
                  <Text style={[styles.score, { color: insp.score >= 80 ? Colors.greenReady : insp.score >= 50 ? Colors.yellowAtRisk : Colors.redUrgent }]}>{insp.score}%</Text>
                )}
              </View>
              <Text style={styles.cardTitle}>{insp.property_name}</Text>
              <View style={styles.meta}>
                <Ionicons name="person" size={14} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{insp.inspector_name}</Text>
                <Ionicons name="time" size={14} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{insp.due_at ? new Date(insp.due_at).toLocaleDateString() : '--'}</Text>
              </View>
              <View style={styles.itemsRow}>
                <View style={styles.itemStat}><Text style={styles.itemNum}>{insp.total_items}</Text><Text style={styles.itemLabel}>Total</Text></View>
                <View style={styles.itemStat}><Text style={[styles.itemNum, { color: Colors.greenReady }]}>{insp.passed_items}</Text><Text style={styles.itemLabel}>Passed</Text></View>
                <View style={styles.itemStat}><Text style={[styles.itemNum, { color: Colors.redUrgent }]}>{insp.failed_items}</Text><Text style={styles.itemLabel}>Failed</Text></View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="clipboard-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No inspections</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  filterTextActive: { color: Colors.primaryForeground },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 30 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  score: { fontSize: 20, fontWeight: '800' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: Colors.textSecondary, marginRight: 8 },
  itemsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
  itemStat: { alignItems: 'center' },
  itemNum: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  itemLabel: { fontSize: 11, color: Colors.textSecondary },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
});
