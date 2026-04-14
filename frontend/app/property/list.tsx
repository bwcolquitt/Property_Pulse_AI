import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/constants/theme';
import api from '../../src/utils/api';

export default function PropertiesListScreen() {
  const router = useRouter();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/properties');
        setProperties(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <FlatList
      style={styles.container}
      data={properties}
      keyExtractor={p => p.id}
      contentContainerStyle={styles.list}
      renderItem={({ item: p }) => (
        <TouchableOpacity testID={`property-${p.id}`} style={styles.card} onPress={() => router.push(`/property/${p.id}`)}>
          {/* Property Photo */}
          {p.cover_photo_url ? (
            <Image source={{ uri: p.cover_photo_url }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Ionicons name="home" size={32} color={Colors.grayInactive} />
            </View>
          )}
          <View style={styles.cardBody}>
            <View style={styles.nameRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{p.nickname || p.name}</Text>
              <Text style={styles.codeTag}>{p.code}</Text>
            </View>
            {p.nickname && <Text style={styles.fullName}>{p.name}</Text>}
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.addressText} numberOfLines={1}>{p.address_1}, {p.city}, {p.state} {p.postal_code}</Text>
            </View>
            <View style={styles.meta}>
              <View style={styles.metaItem}><Ionicons name="bed-outline" size={14} color={Colors.textSecondary} /><Text style={styles.metaText}>{p.bedrooms} BR</Text></View>
              <View style={styles.metaItem}><Ionicons name="water-outline" size={14} color={Colors.textSecondary} /><Text style={styles.metaText}>{p.bathrooms} BA</Text></View>
              <View style={styles.metaItem}><Ionicons name="people-outline" size={14} color={Colors.textSecondary} /><Text style={styles.metaText}>Sleeps {p.sleeps}</Text></View>
            </View>
            <View style={styles.badges}>
              {p.open_issues > 0 && (
                <View style={styles.badge}>
                  <Ionicons name="construct" size={12} color={Colors.redUrgent} />
                  <Text style={styles.badgeText}>{p.open_issues} issue{p.open_issues > 1 ? 's' : ''}</Text>
                </View>
              )}
              {p.open_turnovers > 0 && (
                <View style={[styles.badge, { backgroundColor: Colors.blueAssigned + '12' }]}>
                  <Ionicons name="refresh" size={12} color={Colors.blueAssigned} />
                  <Text style={[styles.badgeText, { color: Colors.blueAssigned }]}>{p.open_turnovers} turnover{p.open_turnovers > 1 ? 's' : ''}</Text>
                </View>
              )}
              {p.open_issues === 0 && p.open_turnovers === 0 && (
                <View style={[styles.badge, { backgroundColor: Colors.greenReady + '12' }]}>
                  <Ionicons name="checkmark-circle" size={12} color={Colors.greenReady} />
                  <Text style={[styles.badgeText, { color: Colors.greenReady }]}>Guest Ready</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  photo: { width: '100%', height: 160 },
  photoPlaceholder: { backgroundColor: Colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: Spacing.md, gap: 6 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  fullName: { fontSize: 13, color: Colors.textSecondary, marginTop: -2 },
  codeTag: { backgroundColor: Colors.primary + '12', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addressText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  meta: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  badges: { flexDirection: 'row', gap: 8, marginTop: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.redUrgent + '12', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600', color: Colors.redUrgent },
});
