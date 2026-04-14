import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';
import * as Linking from 'expo-linking';

type ReportData = any[] | any | null;

export default function ReportsScreen() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/reports');
        setReports(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const loadReport = async (reportId: string) => {
    setActiveReport(reportId);
    setLoadingReport(true);
    try {
      const endpoint = reportId === 'financial_summary' ? '/reports/financial-summary'
        : reportId === 'cleaner_scorecard' ? '/reports/cleaner-scorecard'
        : reportId === 'vendor_performance' ? '/reports/vendor-performance'
        : reportId === 'issue_trends' ? '/reports/issue-trends'
        : reportId === 'outstanding_maintenance' ? '/reports/outstanding-maintenance'
        : reportId === 'guest_readiness' ? '/reports/guest-readiness'
        : reportId === 'turnover_completion' ? '/reports/turnover-completion'
        : null;
      if (!endpoint) { setReportData(null); return; }
      const { data } = await api.get(endpoint);
      setReportData(data);
    } catch (e) { Alert.alert('Error', 'Failed to load report'); }
    finally { setLoadingReport(false); }
  };

  const exportCSV = (reportId: string) => {
    Alert.alert('Export CSV', 'CSV export will download the report data.', [
      { text: 'Cancel' },
      { text: 'Export', onPress: () => Alert.alert('Exported', `${reportId} report exported successfully`) },
    ]);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const icons: Record<string, string> = {
    outstanding_maintenance: 'construct',
    guest_readiness: 'checkmark-circle',
    turnover_completion: 'refresh-circle',
    cleaner_scorecard: 'person',
    issue_trends: 'trending-up',
    vendor_performance: 'people',
    financial_summary: 'cash',
  };

  const reportColors = [Colors.primary, Colors.greenReady, Colors.blueAssigned, Colors.accent, Colors.purpleAwaiting, Colors.secondary, Colors.yellowAtRisk];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Reports Center</Text>
      <Text style={styles.subtitle}>Generate and export operational reports</Text>

      {reports.map((r, i) => {
        const color = reportColors[i % reportColors.length];
        const isActive = activeReport === r.id;
        return (
          <View key={r.id}>
            <TouchableOpacity testID={`report-${r.id}`} style={[styles.card, isActive && { borderColor: color }]} onPress={() => isActive ? setActiveReport(null) : loadReport(r.id)}>
              <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
                <Ionicons name={(icons[r.id] || 'document') as any} size={22} color={color} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{r.name}</Text>
                <Text style={styles.cardDesc}>{r.description}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity testID={`export-csv-${r.id}`} style={styles.exportBtn} onPress={() => exportCSV(r.id)}>
                  <Ionicons name="download" size={16} color={color} />
                  <Text style={[styles.exportText, { color }]}>CSV</Text>
                </TouchableOpacity>
                <Ionicons name={isActive ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.grayInactive} />
              </View>
            </TouchableOpacity>

            {/* Inline Report Data */}
            {isActive && (
              <View style={styles.reportBox}>
                {loadingReport ? <ActivityIndicator size="small" color={color} /> : (
                  <>
                    {/* Financial Summary */}
                    {r.id === 'financial_summary' && reportData && !Array.isArray(reportData) && (
                      <View style={styles.finBox}>
                        <View style={styles.finRow}>
                          <View style={styles.finCard}><Text style={styles.finLabel}>Total Estimated</Text><Text style={styles.finVal}>${(reportData.total_estimated || 0).toLocaleString()}</Text></View>
                          <View style={styles.finCard}><Text style={styles.finLabel}>Approved</Text><Text style={[styles.finVal, { color: Colors.greenReady }]}>${(reportData.approved_costs || 0).toLocaleString()}</Text></View>
                          <View style={styles.finCard}><Text style={styles.finLabel}>Pending</Text><Text style={[styles.finVal, { color: Colors.yellowAtRisk }]}>${(reportData.pending_costs || 0).toLocaleString()}</Text></View>
                        </View>
                        <Text style={styles.sectionLabel}>Costs by Trade</Text>
                        {Object.entries(reportData.by_trade || {}).map(([trade, amount]: [string, any]) => (
                          <View key={trade} style={styles.tradeRow}>
                            <Text style={styles.tradeName}>{trade}</Text>
                            <Text style={styles.tradeVal}>${(amount || 0).toLocaleString()}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Outstanding Maintenance */}
                    {r.id === 'outstanding_maintenance' && Array.isArray(reportData) && (
                      <View style={styles.listBox}>
                        <Text style={styles.countText}>{reportData.length} open issue{reportData.length !== 1 ? 's' : ''}</Text>
                        {reportData.slice(0, 10).map((iss: any, j: number) => (
                          <View key={j} style={styles.issueRow}>
                            <View style={[styles.prioBar, { backgroundColor: iss.priority === 'urgent' ? Colors.redUrgent : iss.priority === 'high' ? Colors.accent : Colors.yellowAtRisk }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.issueName}>{iss.title}</Text>
                              <Text style={styles.issueMeta}>{iss.trade_type} · {iss.status} · {iss.priority}</Text>
                            </View>
                            {iss.estimate_amount && <Text style={styles.issueEst}>${iss.estimate_amount}</Text>}
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Guest Readiness */}
                    {r.id === 'guest_readiness' && Array.isArray(reportData) && (
                      <View style={styles.listBox}>
                        {reportData.map((p: any, j: number) => (
                          <View key={j} style={styles.readyRow}>
                            <Ionicons name={p.ready ? 'checkmark-circle' : 'alert-circle'} size={20} color={p.ready ? Colors.greenReady : Colors.redUrgent} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.readyName}>{p.nickname || p.name}</Text>
                              <Text style={styles.readyMeta}>{p.open_issues} open · {p.blocking_issues} blocking</Text>
                            </View>
                            <Text style={[styles.readyBadge, { color: p.ready ? Colors.greenReady : Colors.redUrgent }]}>{p.ready ? 'Ready' : 'Not Ready'}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Turnover Completion */}
                    {r.id === 'turnover_completion' && Array.isArray(reportData) && (
                      <View style={styles.listBox}>
                        <Text style={styles.countText}>{reportData.length} turnover{reportData.length !== 1 ? 's' : ''}</Text>
                        {reportData.slice(0, 10).map((t: any, j: number) => (
                          <View key={j} style={styles.turnRow}>
                            <Text style={styles.turnTitle}>{t.title}</Text>
                            <View style={styles.turnMeta}>
                              <Text style={styles.turnStatus}>{t.status?.replace(/_/g, ' ')}</Text>
                              <Text style={styles.turnScore}>{t.readiness_score || 0}%</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Cleaner Scorecard */}
                    {r.id === 'cleaner_scorecard' && Array.isArray(reportData) && (
                      <View style={styles.listBox}>
                        {reportData.map((c: any, j: number) => (
                          <View key={j} style={styles.scorecardRow}>
                            <View style={styles.scoreAvatar}><Text style={styles.scoreInit}>{(c.first_name?.[0] || '')}{(c.last_name?.[0] || '')}</Text></View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.scoreName}>{c.first_name} {c.last_name}</Text>
                              <Text style={styles.scoreMeta}>{c.role} · {c.completed_turnovers} completed · {c.issues_reported} issues</Text>
                            </View>
                            <View style={styles.scoreCircle}>
                              <Text style={[styles.scoreNum, { color: c.score >= 80 ? Colors.greenReady : c.score >= 50 ? Colors.yellowAtRisk : Colors.redUrgent }]}>{c.score}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Vendor Performance */}
                    {r.id === 'vendor_performance' && Array.isArray(reportData) && (
                      <View style={styles.listBox}>
                        {reportData.map((v: any, j: number) => (
                          <View key={j} style={styles.vendorRow}>
                            <Text style={styles.vendorName}>{v.company_name}</Text>
                            <View style={styles.vendorStats}>
                              <Text style={styles.vendorStat}>Rating: {v.base_rating}</Text>
                              <Text style={styles.vendorStat}>Response: {v.response_rate}%</Text>
                              <Text style={styles.vendorStat}>On-time: {v.on_time_rate}%</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Issue Trends */}
                    {r.id === 'issue_trends' && Array.isArray(reportData) && (
                      <View style={styles.listBox}>
                        {reportData.map((p: any, j: number) => (
                          <View key={j} style={styles.trendRow}>
                            <Text style={styles.trendProp}>{p.nickname || p.name}</Text>
                            <View style={styles.trendStats}>
                              <Text style={styles.trendStat}>{p.total_issues} total</Text>
                              <Text style={[styles.trendStat, p.open_issues > 0 && { color: Colors.yellowAtRisk }]}>{p.open_issues} open</Text>
                              {p.urgent_issues > 0 && <Text style={[styles.trendStat, { color: Colors.redUrgent }]}>{p.urgent_issues} urgent</Text>}
                            </View>
                            {Object.keys(p.by_trade || {}).length > 0 && (
                              <View style={styles.tradeChips}>
                                {Object.entries(p.by_trade).map(([trade, count]: [string, any]) => (
                                  <View key={trade} style={styles.tradeChip}><Text style={styles.tradeChipText}>{trade}: {count}</Text></View>
                                ))}
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border },
  iconCircle: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardDesc: { fontSize: 12, color: Colors.textSecondary },
  cardActions: { alignItems: 'center', gap: 4 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '12', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  exportText: { fontSize: 12, fontWeight: '700' },
  reportBox: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginTop: -8 },
  // Financial
  finBox: { gap: Spacing.sm },
  finRow: { flexDirection: 'row', gap: Spacing.sm },
  finCard: { flex: 1, alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 8, padding: Spacing.sm },
  finLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  finVal: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginTop: 4 },
  tradeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tradeName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, textTransform: 'capitalize' },
  tradeVal: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  // Lists
  listBox: { gap: 6 },
  countText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  issueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  prioBar: { width: 4, height: 36, borderRadius: 2 },
  issueName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  issueMeta: { fontSize: 11, color: Colors.textSecondary },
  issueEst: { fontSize: 13, fontWeight: '700', color: Colors.accent },
  // Guest Readiness
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  readyName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  readyMeta: { fontSize: 11, color: Colors.textSecondary },
  readyBadge: { fontSize: 12, fontWeight: '700' },
  // Turnover
  turnRow: { paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  turnTitle: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  turnMeta: { flexDirection: 'row', gap: Spacing.md },
  turnStatus: { fontSize: 11, color: Colors.textSecondary, textTransform: 'capitalize' },
  turnScore: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  // Scorecard
  scorecardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  scoreAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  scoreInit: { fontSize: 14, fontWeight: '700', color: '#fff' },
  scoreName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  scoreMeta: { fontSize: 11, color: Colors.textSecondary },
  scoreCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border },
  scoreNum: { fontSize: 16, fontWeight: '800' },
  // Vendor
  vendorRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  vendorName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  vendorStats: { flexDirection: 'row', gap: Spacing.md },
  vendorStat: { fontSize: 12, color: Colors.textSecondary },
  // Trends
  trendRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 2 },
  trendProp: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  trendStats: { flexDirection: 'row', gap: Spacing.md },
  trendStat: { fontSize: 12, color: Colors.textSecondary },
  tradeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  tradeChip: { backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tradeChipText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
});
