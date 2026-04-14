import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, StatusColors, PriorityColors } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/utils/api';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/stats');
      setStats(data);
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const onRefresh = () => { setRefreshing(true); fetchStats(); };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      {/* Welcome */}
      <View style={styles.welcome}>
        <View>
          <Text style={styles.greeting}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},</Text>
          <Text style={styles.userName}>{user?.first_name || 'Manager'}</Text>
        </View>
        <View style={styles.readinessCircle}>
          <Text style={styles.readinessNumber}>{stats?.readiness_score || 0}%</Text>
          <Text style={styles.readinessLabel}>Ready</Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        {[
          { label: "Today's Turns", value: stats?.todays_turnovers || 0, color: Colors.primary, icon: 'refresh-circle' },
          { label: 'At Risk', value: stats?.properties_at_risk || 0, color: Colors.yellowAtRisk, icon: 'warning' },
          { label: 'Inspections', value: stats?.pending_inspections || 0, color: Colors.purpleAwaiting, icon: 'clipboard' },
          { label: 'Properties', value: stats?.total_properties || 0, color: Colors.secondary, icon: 'home' },
        ].map((s, i) => (
          <View key={i} style={styles.statCard}>
            <Ionicons name={s.icon as any} size={22} color={s.color} />
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* FLAGSHIP: Outstanding Maintenance Widget */}
      <TouchableOpacity testID="maintenance-widget" style={styles.maintenanceWidget} onPress={() => router.push('/(tabs)/maintenance')}>
        <View style={styles.widgetHeader}>
          <View style={styles.widgetTitleRow}>
            <Ionicons name="construct" size={22} color={Colors.redUrgent} />
            <Text style={styles.widgetTitle}>Outstanding Maintenance</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </View>
        <View style={styles.maintenanceGrid}>
          {[
            { label: 'Total Open', value: stats?.total_outstanding_maintenance || 0, color: Colors.textPrimary },
            { label: 'Urgent', value: stats?.urgent_maintenance || 0, color: Colors.redUrgent },
            { label: 'Due Today', value: stats?.due_today_maintenance || 0, color: Colors.yellowAtRisk },
            { label: 'Unassigned', value: stats?.unassigned_maintenance || 0, color: Colors.accent },
            { label: 'Blocking Guest', value: stats?.blocking_guest || 0, color: Colors.redUrgent },
          ].map((m, i) => (
            <View key={i} style={styles.maintenanceStat}>
              <Text style={[styles.maintenanceValue, { color: m.color }]}>{m.value}</Text>
              <Text style={styles.maintenanceLabel}>{m.label}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>

      {/* Recent Issues */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Issues</Text>
          <TouchableOpacity testID="view-all-issues" onPress={() => router.push('/(tabs)/maintenance')}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>
        {stats?.recent_issues?.slice(0, 4).map((issue: any, i: number) => (
          <TouchableOpacity key={i} testID={`issue-card-${i}`} style={styles.issueCard} onPress={() => router.push(`/issue/${issue.id}`)}>
            <View style={[styles.priorityDot, { backgroundColor: PriorityColors[issue.priority] || Colors.grayInactive }]} />
            <View style={styles.issueInfo}>
              <Text style={styles.issueTitle} numberOfLines={1}>{issue.title}</Text>
              <Text style={styles.issueSubtitle}>{issue.property_name || issue.trade_type} · {issue.status?.replace(/_/g, ' ')}</Text>
            </View>
            {issue.blocks_check_in && (
              <View style={styles.blocksBadge}>
                <Text style={styles.blocksBadgeText}>BLOCKS</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={Colors.grayInactive} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {[
            { label: 'New Turnover', icon: 'add-circle', route: '/(tabs)/turnovers' },
            { label: 'Report Issue', icon: 'alert-circle', route: '/(tabs)/maintenance' },
            { label: 'Messages', icon: 'chatbubbles', route: '/messages' },
            { label: 'Reports', icon: 'bar-chart', route: '/reports' },
          ].map((a, i) => (
            <TouchableOpacity key={i} testID={`action-${a.label.replace(/\s/g, '-').toLowerCase()}`} style={styles.actionBtn} onPress={() => router.push(a.route as any)}>
              <View style={[styles.actionIcon, { backgroundColor: [Colors.primary, Colors.redUrgent, Colors.blueAssigned, Colors.purpleAwaiting][i] + '15' }]}>
                <Ionicons name={a.icon as any} size={22} color={[Colors.primary, Colors.redUrgent, Colors.blueAssigned, Colors.purpleAwaiting][i]} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  welcome: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.lg },
  greeting: { fontSize: 14, color: Colors.textSecondary },
  userName: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  readinessCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.greenReady + '15', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.greenReady },
  readinessNumber: { fontSize: 18, fontWeight: '800', color: Colors.greenReady },
  readinessLabel: { fontSize: 10, fontWeight: '600', color: Colors.greenReady },
  statsGrid: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, gap: 4 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  maintenanceWidget: { marginHorizontal: Spacing.md, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.redUrgent + '40', marginBottom: Spacing.md },
  widgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  widgetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  widgetTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  maintenanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  maintenanceStat: { width: '30%', alignItems: 'center', paddingVertical: Spacing.sm, backgroundColor: Colors.surfaceSecondary, borderRadius: 8 },
  maintenanceValue: { fontSize: 22, fontWeight: '800' },
  maintenanceLabel: { fontSize: 11, fontWeight: '500', color: Colors.textSecondary, textAlign: 'center' },
  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  viewAll: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  issueCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  issueInfo: { flex: 1 },
  issueTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  issueSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  blocksBadge: { backgroundColor: Colors.redUrgent + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  blocksBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.redUrgent },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  actionBtn: { flex: 1, alignItems: 'center', gap: Spacing.sm },
  actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
});
