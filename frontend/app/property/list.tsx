import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
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
          <View style={styles.cardHeader}>
            <Ionicons name="home" size={20} color={Colors.primary} />
            <Text style={styles.cardTitle}>{p.name}</Text>
          </View>
          <Text style={styles.cardSubtext}>{p.address_1}, {p.city}, {p.state}</Text>
          <View style={styles.meta}>
            <Text style={styles.metaText}>{p.bedrooms}BR · {p.bathrooms}BA · Sleeps {p.sleeps}</Text>
          </View>
          <View style={styles.badges}>
            {p.open_issues > 0 && <View style={styles.badge}><Ionicons name="construct" size={12} color={Colors.redUrgent} /><Text style={styles.badgeText}>{p.open_issues} issues</Text></View>}
            {p.open_turnovers > 0 && <View style={[styles.badge, { backgroundColor: Colors.blueAssigned + '12' }]}><Ionicons name="refresh" size={12} color={Colors.blueAssigned} /><Text style={[styles.badgeText, { color: Colors.blueAssigned }]}>{p.open_turnovers} turnovers</Text></View>}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  cardSubtext: { fontSize: 13, color: Colors.textSecondary },
  meta: { marginTop: 2 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  badges: { flexDirection: 'row', gap: 8, marginTop: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.redUrgent + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600', color: Colors.redUrgent },
});
