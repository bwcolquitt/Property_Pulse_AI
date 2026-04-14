import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

type AIFeature = 'schedule' | 'patterns' | 'inventory' | 'debrief' | null;

export default function AICommandScreen() {
  const [activeFeature, setActiveFeature] = useState<AIFeature>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runFeature = async (feature: AIFeature) => {
    setActiveFeature(feature);
    setLoading(true);
    setResult(null);
    try {
      let data;
      if (feature === 'schedule') {
        ({ data } = await api.post('/ai-smart/auto-schedule', { date_range_days: 7 }));
      } else if (feature === 'patterns') {
        ({ data } = await api.post('/ai-smart/issue-patterns', {}));
      } else if (feature === 'inventory') {
        ({ data } = await api.post('/ai-smart/predictive-inventory', {}));
      }
      setResult(data);
    } catch (e) { Alert.alert('Error', 'AI analysis failed. Try again.'); }
    finally { setLoading(false); }
  };

  const features = [
    { id: 'schedule' as AIFeature, icon: 'calendar', title: 'Auto-Schedule', desc: 'AI optimizes turnover scheduling to avoid conflicts and maximize efficiency', color: Colors.primary },
    { id: 'patterns' as AIFeature, icon: 'analytics', title: 'Issue Patterns', desc: 'Detect recurring maintenance patterns and predict future problems', color: Colors.redUrgent },
    { id: 'inventory' as AIFeature, icon: 'cube', title: 'Predictive Inventory', desc: 'Predict supply needs based on upcoming turnovers and usage trends', color: Colors.greenReady },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={28} color={Colors.accent} />
        <Text style={styles.title}>AI Command Center</Text>
      </View>
      <Text style={styles.subtitle}>Powered by GPT-5.2 — tap any feature to run AI analysis</Text>

      {/* Feature Cards */}
      {features.map(f => (
        <TouchableOpacity key={f.id} testID={`ai-${f.id}`} style={[styles.featureCard, activeFeature === f.id && { borderColor: f.color }]} onPress={() => runFeature(f.id)}>
          <View style={[styles.featureIcon, { backgroundColor: f.color + '15' }]}>
            <Ionicons name={f.icon as any} size={24} color={f.color} />
          </View>
          <View style={styles.featureInfo}>
            <Text style={styles.featureName}>{f.title}</Text>
            <Text style={styles.featureDesc}>{f.desc}</Text>
          </View>
          {loading && activeFeature === f.id ? <ActivityIndicator color={f.color} /> : <Ionicons name="play-circle" size={28} color={f.color} />}
        </TouchableOpacity>
      ))}

      {/* Results */}
      {result && activeFeature === 'schedule' && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Schedule Optimization</Text>
          {result.overall_efficiency_score !== undefined && (
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Efficiency Score</Text>
              <Text style={[styles.scoreValue, { color: result.overall_efficiency_score >= 80 ? Colors.greenReady : Colors.yellowAtRisk }]}>{result.overall_efficiency_score}/100</Text>
            </View>
          )}
          {result.recommendations?.map((r: string, i: number) => (
            <View key={i} style={styles.recRow}><Ionicons name="bulb" size={14} color={Colors.accent} /><Text style={styles.recText}>{r}</Text></View>
          ))}
          {result.schedule?.map((s: any, i: number) => (
            <View key={i} style={styles.schedItem}>
              <Text style={styles.schedProp}>{s.property}</Text>
              {s.recommended_services?.map((svc: any, j: number) => (
                <View key={j} style={styles.svcRec}>
                  <Text style={styles.svcType}>{svc.service_type}: {svc.suggested_start} - {svc.suggested_end}</Text>
                  <Text style={styles.svcProvider}>{svc.suggested_provider}</Text>
                  <Text style={styles.svcReason}>{svc.reason}</Text>
                </View>
              ))}
              {s.optimization_notes && <Text style={styles.optNote}>{s.optimization_notes}</Text>}
            </View>
          ))}
        </View>
      )}

      {result && activeFeature === 'patterns' && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Issue Pattern Analysis</Text>
          {result.summary && <Text style={styles.summary}>{result.summary}</Text>}
          {result.recurring_patterns?.length > 0 && (
            <View style={styles.section}><Text style={styles.sectionLabel}>Recurring Patterns</Text>
              {result.recurring_patterns.map((p: any, i: number) => (
                <View key={i} style={styles.patternRow}>
                  <View style={[styles.sevDot, { backgroundColor: p.severity === 'high' ? Colors.redUrgent : p.severity === 'medium' ? Colors.yellowAtRisk : Colors.greenReady }]} />
                  <View style={{flex: 1}}><Text style={styles.patternText}>{p.pattern}</Text><Text style={styles.patternFreq}>{p.frequency} · {p.trade_type}</Text></View>
                </View>
              ))}
            </View>
          )}
          {result.predictive_alerts?.length > 0 && (
            <View style={styles.section}><Text style={styles.sectionLabel}>Predictions</Text>
              {result.predictive_alerts.map((a: any, i: number) => (
                <View key={i} style={styles.alertRow}><Ionicons name="warning" size={14} color={Colors.yellowAtRisk} /><View style={{flex:1}}><Text style={styles.alertText}>{a.prediction}</Text><Text style={styles.alertAction}>{a.recommended_action}</Text></View></View>
              ))}
            </View>
          )}
          {result.preventive_recommendations?.length > 0 && (
            <View style={styles.section}><Text style={styles.sectionLabel}>Preventive Actions</Text>
              {result.preventive_recommendations.map((r: any, i: number) => (
                <View key={i} style={styles.recRow}><Ionicons name="shield-checkmark" size={14} color={Colors.greenReady} /><Text style={styles.recText}>{r.recommendation} {r.estimated_savings ? `(Save ${r.estimated_savings})` : ''}</Text></View>
              ))}
            </View>
          )}
        </View>
      )}

      {result && activeFeature === 'inventory' && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Predictive Inventory</Text>
          {result.total_estimated_cost && <Text style={styles.totalCost}>Estimated reorder cost: ${result.total_estimated_cost}</Text>}
          {result.urgent_reorders?.length > 0 && (
            <View style={styles.section}><Text style={styles.sectionLabel}>Urgent Reorders</Text>
              {result.urgent_reorders.map((r: any, i: number) => (
                <View key={i} style={styles.reorderRow}>
                  <Ionicons name="alert-circle" size={14} color={r.urgency === 'immediate' ? Colors.redUrgent : Colors.yellowAtRisk} />
                  <Text style={styles.reorderText}>{r.item}: Order {r.order_qty} (current: {r.current_qty}, need: {r.predicted_need})</Text>
                  <Text style={[styles.urgencyBadge, { color: r.urgency === 'immediate' ? Colors.redUrgent : Colors.yellowAtRisk }]}>{r.urgency}</Text>
                </View>
              ))}
            </View>
          )}
          {result.shopping_list?.length > 0 && (
            <View style={styles.section}><Text style={styles.sectionLabel}>Shopping List</Text>
              {result.shopping_list.map((s: any, i: number) => (
                <View key={i} style={styles.shopRow}>
                  <Text style={styles.shopItem}>{s.item}</Text>
                  <Text style={styles.shopQty}>x{s.quantity}</Text>
                  <Text style={styles.shopCost}>${s.estimated_cost}</Text>
                </View>
              ))}
            </View>
          )}
          {result.cost_optimization?.length > 0 && (
            <View style={styles.section}><Text style={styles.sectionLabel}>Cost Savings</Text>
              {result.cost_optimization.map((c: any, i: number) => (
                <View key={i} style={styles.recRow}><Ionicons name="trending-down" size={14} color={Colors.greenReady} /><Text style={styles.recText}>{c.suggestion} {c.potential_savings ? `(${c.potential_savings})` : ''}</Text></View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: -8 },
  featureCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border },
  featureIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  featureInfo: { flex: 1, gap: 2 },
  featureName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  featureDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  resultBox: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '30', gap: Spacing.sm },
  resultTitle: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 8, padding: Spacing.sm },
  scoreLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  scoreValue: { fontSize: 24, fontWeight: '800' },
  section: { gap: 6, marginTop: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 3 },
  recText: { flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  schedItem: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, padding: Spacing.sm, gap: 4 },
  schedProp: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  svcRec: { paddingLeft: 8, gap: 1 },
  svcType: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  svcProvider: { fontSize: 11, color: Colors.textSecondary },
  svcReason: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic' },
  optNote: { fontSize: 11, color: Colors.accent, fontStyle: 'italic' },
  summary: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, fontStyle: 'italic' },
  patternRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  sevDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  patternText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  patternFreq: { fontSize: 11, color: Colors.textSecondary },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 4 },
  alertText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  alertAction: { fontSize: 11, color: Colors.blueAssigned },
  totalCost: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  reorderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  reorderText: { flex: 1, fontSize: 12, color: Colors.textPrimary },
  urgencyBadge: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  shopRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  shopItem: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  shopQty: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, width: 40 },
  shopCost: { fontSize: 13, fontWeight: '700', color: Colors.primary, width: 60, textAlign: 'right' },
});
