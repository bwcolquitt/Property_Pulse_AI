import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/constants/theme';
import api from '../../src/utils/api';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/properties/${id}`);
        setProperty(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!property) return <View style={styles.loading}><Text>Not found</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{property.name}</Text>
      <Text style={styles.subtitle}>{property.address_1}, {property.city}, {property.state}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Ionicons name="bed" size={18} color={Colors.primary} /><Text style={styles.statText}>{property.bedrooms} BR</Text></View>
        <View style={styles.stat}><Ionicons name="water" size={18} color={Colors.primary} /><Text style={styles.statText}>{property.bathrooms} BA</Text></View>
        <View style={styles.stat}><Ionicons name="people" size={18} color={Colors.primary} /><Text style={styles.statText}>Sleeps {property.sleeps}</Text></View>
      </View>

      {property.access && Object.keys(property.access).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Access Info</Text>
          {property.access.entry_method && <View style={styles.row}><Text style={styles.label}>Entry:</Text><Text style={styles.value}>{property.access.entry_method}</Text></View>}
          {property.access.lock_code && <View style={styles.row}><Text style={styles.label}>Code:</Text><Text style={styles.value}>{property.access.lock_code}</Text></View>}
          {property.access.wifi_name && <View style={styles.row}><Text style={styles.label}>WiFi:</Text><Text style={styles.value}>{property.access.wifi_name} / {property.access.wifi_password}</Text></View>}
          {property.access.parking_notes && <View style={styles.row}><Text style={styles.label}>Parking:</Text><Text style={styles.value}>{property.access.parking_notes}</Text></View>}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Open Issues ({property.open_issues})</Text>
        {property.issues?.map((i: any, idx: number) => (
          <View key={idx} style={styles.issueRow}>
            <View style={[styles.dot, { backgroundColor: i.priority === 'urgent' ? Colors.redUrgent : Colors.yellowAtRisk }]} />
            <Text style={styles.issueText}>{i.title}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: Spacing.md },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  statText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  section: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  row: { flexDirection: 'row', gap: Spacing.sm },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, width: 60 },
  value: { fontSize: 13, color: Colors.textPrimary, flex: 1 },
  issueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  issueText: { fontSize: 14, color: Colors.textPrimary, flex: 1 },
});
