import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function InventoryScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetch = async () => {
    try {
      const params: any = {};
      if (filter === 'low_stock') params.low_stock = true;
      const { data } = await api.get('/inventory', { params });
      setItems(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); fetch(); }, [filter]);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={['all', 'low_stock']}
        keyExtractor={f => f}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: f }) => (
          <TouchableOpacity testID={`filter-${f}`} style={[styles.filterBtn, filter === f && styles.filterActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f === 'all' ? 'All Items' : 'Low Stock'}</Text>
          </TouchableOpacity>
        )}
      />
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={fetch} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <View testID={`inv-${item.id}`} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.catIcon, { backgroundColor: item.category === 'linens' ? Colors.blueAssigned + '15' : item.category === 'toiletries' ? Colors.purpleAwaiting + '15' : item.category === 'cleaning' ? Colors.greenReady + '15' : Colors.accent + '15' }]}>
                <Ionicons name={item.category === 'linens' ? 'shirt' : item.category === 'toiletries' ? 'water' : item.category === 'cleaning' ? 'sparkles' : 'cafe'} size={20} color={item.category === 'linens' ? Colors.blueAssigned : item.category === 'toiletries' ? Colors.purpleAwaiting : item.category === 'cleaning' ? Colors.greenReady : Colors.accent} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSub}>{item.property_name} · {item.category}</Text>
              </View>
              {item.is_low_stock && (
                <View style={styles.lowBadge}><Ionicons name="warning" size={14} color={Colors.redUrgent} /><Text style={styles.lowText}>Low</Text></View>
              )}
            </View>
            <View style={styles.levelsRow}>
              <View style={styles.levelItem}>
                <Text style={[styles.levelNum, item.is_low_stock && { color: Colors.redUrgent }]}>{item.quantity_on_hand}</Text>
                <Text style={styles.levelLabel}>On Hand</Text>
              </View>
              <View style={styles.levelDivider} />
              <View style={styles.levelItem}>
                <Text style={styles.levelNum}>{item.par_level}</Text>
                <Text style={styles.levelLabel}>Par Level</Text>
              </View>
              <View style={styles.levelDivider} />
              <View style={styles.levelItem}>
                <Text style={styles.levelNum}>{item.reorder_level}</Text>
                <Text style={styles.levelLabel}>Reorder At</Text>
              </View>
            </View>
            {/* Progress bar showing stock level */}
            <View style={styles.stockBar}>
              <View style={[styles.stockFill, { width: `${Math.min(100, (item.quantity_on_hand / Math.max(item.par_level, 1)) * 100)}%`, backgroundColor: item.is_low_stock ? Colors.redUrgent : Colors.greenReady }]} />
            </View>
          </View>
        )}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="cube-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No inventory items</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: Colors.primaryForeground },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 30 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardSub: { fontSize: 12, color: Colors.textSecondary },
  lowBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.redUrgent + '12', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  lowText: { fontSize: 11, fontWeight: '700', color: Colors.redUrgent },
  levelsRow: { flexDirection: 'row', alignItems: 'center' },
  levelItem: { flex: 1, alignItems: 'center' },
  levelNum: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  levelLabel: { fontSize: 11, color: Colors.textSecondary },
  levelDivider: { width: 1, height: 30, backgroundColor: Colors.border },
  stockBar: { height: 6, backgroundColor: Colors.surfaceSecondary, borderRadius: 3 },
  stockFill: { height: 6, borderRadius: 3 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
});
