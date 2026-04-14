import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/constants/theme';
import api from '../../src/utils/api';

export default function MarketplaceScreen() {
  const router = useRouter();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchProviders = useCallback(async () => {
    try {
      const params: any = {};
      if (filter !== 'all') params.service_type = filter;
      const { data } = await api.get('/marketplace/providers', { params });
      setProviders(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const renderProvider = ({ item }: { item: any }) => (
    <TouchableOpacity testID={`provider-${item.id}`} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: item.provider_type === 'cleaning' ? Colors.secondary + '30' : Colors.accent + '30' }]}>
          <Ionicons name={item.provider_type === 'cleaning' ? 'sparkles' : 'construct'} size={24} color={item.provider_type === 'cleaning' ? Colors.primary : Colors.accent} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.companyName}>{item.company_name}</Text>
          <Text style={styles.providerType}>{item.provider_type}</Text>
        </View>
        {item.preferred_vendor && (
          <View style={styles.preferredBadge}><Ionicons name="star" size={12} color={Colors.yellowAtRisk} /><Text style={styles.preferredText}>Preferred</Text></View>
        )}
      </View>
      <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text>
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Ionicons name="star" size={14} color={Colors.yellowAtRisk} />
          <Text style={styles.metricValue}>{item.base_rating}</Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="flash" size={14} color={Colors.greenReady} />
          <Text style={styles.metricValue}>{item.response_rate}%</Text>
          <Text style={styles.metricLabel}>response</Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="time" size={14} color={Colors.blueAssigned} />
          <Text style={styles.metricValue}>{item.on_time_rate}%</Text>
          <Text style={styles.metricLabel}>on-time</Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="people" size={14} color={Colors.textSecondary} />
          <Text style={styles.metricValue}>{item.team_size}</Text>
        </View>
      </View>
      {item.emergency_available && (
        <View style={styles.emergencyBadge}><Ionicons name="flash" size={14} color={Colors.greenReady} /><Text style={styles.emergencyText}>Emergency Available</Text></View>
      )}
      <View style={styles.servicesRow}>
        {item.services?.slice(0, 3).map((s: any, i: number) => (
          <View key={i} style={styles.serviceTag}>
            <Text style={styles.serviceText}>{s.service_type} {s.base_price ? `$${s.base_price}` : ''}</Text>
          </View>
        ))}
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity testID={`book-${item.id}`} style={styles.bookBtn}>
          <Text style={styles.bookBtnText}>Book Now</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`message-${item.id}`} style={styles.messageBtn}>
          <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={['all', 'cleaning', 'maintenance']}
        keyExtractor={f => f}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: f }) => (
          <TouchableOpacity testID={`filter-${f}`} style={[styles.filterBtn, filter === f && styles.filterActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f === 'all' ? 'All Providers' : f === 'cleaning' ? 'Cleaners' : 'Maintenance'}</Text>
          </TouchableOpacity>
        )}
      />
      <FlatList
        data={providers}
        keyExtractor={item => item.id}
        renderItem={renderProvider}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProviders(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="storefront-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No providers found</Text></View>}
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
  list: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 30 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  providerType: { fontSize: 13, color: Colors.textSecondary, textTransform: 'capitalize' },
  preferredBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.yellowAtRisk + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  preferredText: { fontSize: 11, fontWeight: '700', color: Colors.yellowAtRisk },
  bio: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  metricsRow: { flexDirection: 'row', gap: Spacing.md },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metricValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  metricLabel: { fontSize: 11, color: Colors.textSecondary },
  emergencyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.greenReady + '12', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  emergencyText: { fontSize: 12, fontWeight: '600', color: Colors.greenReady },
  servicesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  serviceTag: { backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  serviceText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  bookBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  bookBtnText: { color: Colors.primaryForeground, fontSize: 14, fontWeight: '700' },
  messageBtn: { width: 44, height: 40, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
});
