import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function ReportsScreen() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/reports');
        setReports(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const icons: Record<string, string> = {
    outstanding_maintenance: 'construct',
    guest_readiness: 'checkmark-circle',
    turnover_completion: 'refresh-circle',
    cleaner_scorecard: 'person',
    issue_trends: 'trending-up',
    vendor_performance: 'people',
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Reports Center</Text>
      <Text style={styles.subtitle}>Generate and export operational reports</Text>
      {reports.map((r, i) => (
        <TouchableOpacity key={i} testID={`report-${r.id}`} style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: [Colors.primary, Colors.greenReady, Colors.blueAssigned, Colors.accent, Colors.purpleAwaiting, Colors.secondary][i % 6] + '15' }]}>
            <Ionicons name={(icons[r.id] || 'document') as any} size={22} color={[Colors.primary, Colors.greenReady, Colors.blueAssigned, Colors.accent, Colors.purpleAwaiting, Colors.secondary][i % 6]} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{r.name}</Text>
            <Text style={styles.cardDesc}>{r.description}</Text>
          </View>
          <View style={styles.exportBtns}>
            <TouchableOpacity testID={`export-csv-${r.id}`} style={styles.exportBtn}>
              <Ionicons name="document-text" size={16} color={Colors.primary} />
              <Text style={styles.exportText}>CSV</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  iconCircle: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardDesc: { fontSize: 12, color: Colors.textSecondary },
  exportBtns: { gap: 4 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '12', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  exportText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
});
