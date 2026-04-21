import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const DAY_OPTIONS = [7, 30, 90];

export default function CleanerScorecardsScreen() {
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (d: number = days) => {
    try {
      const { data } = await api.get(`/scorecards/cleaners?days=${d}`);
      setData(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { load(); }, [days]);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const cleaners = data?.cleaners || [];
  const top = cleaners[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <Text style={styles.title}>Cleaner Scorecards</Text>
      <Text style={styles.subtitle}>Performance metrics: completion rate, photo coverage, quality, issues reported</Text>

      <View style={styles.dayTabs}>{DAY_OPTIONS.map(d => (
        <TouchableOpacity key={d} style={[styles.dayBtn, days === d && styles.dayBtnActive]} onPress={() => setDays(d)}>
          <Text style={[styles.dayText, days === d && { color: '#fff' }]}>Last {d}d</Text>
        </TouchableOpacity>
      ))}</View>

      {top && top.turnovers_completed > 0 && (
        <View style={styles.topCard}>
          <View style={styles.topHead}><Ionicons name="trophy" size={28} color={Colors.accent} /><View style={{ flex: 1 }}><Text style={styles.topLabel}>TOP PERFORMER</Text><Text style={styles.topName}>{top.cleaner_name || top.cleaner_email}</Text></View><Text style={styles.topScore}>{top.performance_score}</Text></View>
          <View style={styles.topMetrics}>
            <View style={styles.topMetric}><Text style={styles.topMetricNum}>{top.turnovers_completed}</Text><Text style={styles.topMetricLabel}>Turnovers</Text></View>
            <View style={styles.topMetric}><Text style={styles.topMetricNum}>{top.photo_coverage_pct}%</Text><Text style={styles.topMetricLabel}>Photo Coverage</Text></View>
            <View style={styles.topMetric}><Text style={styles.topMetricNum}>{top.avg_quality_rating || '—'}</Text><Text style={styles.topMetricLabel}>Avg Rating</Text></View>
          </View>
        </View>
      )}

      {cleaners.length === 0 ? (
        <View style={styles.empty}><Ionicons name="people-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No cleaner data yet</Text><Text style={styles.emptyHint}>Scores appear as turnovers complete</Text></View>
      ) : (
        cleaners.map((c: any, i: number) => (
          <View key={c.cleaner_id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={[styles.rankBadge, { backgroundColor: i === 0 ? Colors.accent : i === 1 ? Colors.grayInactive : Colors.surfaceSecondary }]}><Text style={[styles.rankText, { color: i < 2 ? '#fff' : Colors.textSecondary }]}>#{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cleanerName}>{c.cleaner_name || c.cleaner_email}</Text>
                <Text style={styles.cleanerEmail}>{c.cleaner_email}</Text>
              </View>
              <View style={styles.scoreBox}>
                <Text style={styles.scoreNum}>{c.performance_score}</Text>
                <Text style={styles.scoreLabel}>Score</Text>
              </View>
            </View>

            <View style={styles.metrics}>
              <View style={styles.metric}><Ionicons name="checkmark-done" size={14} color={Colors.greenReady} /><Text style={styles.metricVal}>{c.turnovers_completed}/{c.turnovers_assigned}</Text><Text style={styles.metricLabel}>Done</Text></View>
              <View style={styles.metric}><Ionicons name="camera" size={14} color={Colors.primary} /><Text style={styles.metricVal}>{c.photo_coverage_pct}%</Text><Text style={styles.metricLabel}>Photos</Text></View>
              <View style={styles.metric}><Ionicons name="time" size={14} color={Colors.blueAssigned} /><Text style={styles.metricVal}>{c.avg_duration_min ? `${c.avg_duration_min}m` : '—'}</Text><Text style={styles.metricLabel}>Avg Time</Text></View>
              <View style={styles.metric}><Ionicons name="warning" size={14} color={Colors.redUrgent} /><Text style={styles.metricVal}>{c.issues_reported}</Text><Text style={styles.metricLabel}>Issues</Text></View>
              <View style={styles.metric}><Ionicons name="star" size={14} color={Colors.yellowAtRisk} /><Text style={styles.metricVal}>{c.avg_quality_rating || '—'}</Text><Text style={styles.metricLabel}>Rating</Text></View>
              <View style={styles.metric}><Ionicons name="images" size={14} color={Colors.accent} /><Text style={styles.metricVal}>{c.photos_taken}</Text><Text style={styles.metricLabel}>Photos</Text></View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  dayTabs: { flexDirection: 'row', gap: 8 },
  dayBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  dayBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  topCard: { backgroundColor: Colors.accent + '10', borderRadius: 14, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.accent, gap: 12, marginTop: 8 },
  topHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topLabel: { fontSize: 10, fontWeight: '800', color: Colors.accent, letterSpacing: 1 },
  topName: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  topScore: { fontSize: 36, fontWeight: '900', color: Colors.accent },
  topMetrics: { flexDirection: 'row', gap: 8 },
  topMetric: { flex: 1, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border },
  topMetricNum: { fontSize: 18, fontWeight: '800', color: Colors.accent },
  topMetricLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase' },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  rankText: { fontSize: 13, fontWeight: '800' },
  cleanerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cleanerEmail: { fontSize: 11, color: Colors.textSecondary },
  scoreBox: { alignItems: 'center' },
  scoreNum: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  scoreLabel: { fontSize: 9, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, minWidth: 90 },
  metricVal: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  metricLabel: { fontSize: 10, color: Colors.textSecondary, marginLeft: 2 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  emptyHint: { fontSize: 12, color: Colors.grayInactive },
});
