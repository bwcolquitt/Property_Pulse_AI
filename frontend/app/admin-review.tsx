import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, PriorityColors } from '../src/constants/theme';
import api from '../src/utils/api';

export default function AdminReviewScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviseModal, setReviseModal] = useState<any>(null);
  const [reviseAmount, setReviseAmount] = useState('');

  const fetch = useCallback(async () => {
    try {
      const [statsRes, queueRes] = await Promise.all([
        api.get('/admin/dashboard-stats'),
        api.get('/admin/review-queue'),
      ]);
      setStats(statsRes.data);
      setQueue(queueRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAction = async (issueId: string, action: string, amount?: number) => {
    try {
      const body: any = { action };
      if (action === 'revise') body.revised_amount = amount;
      await api.put(`/admin/estimate/${issueId}`, body);
      Alert.alert('Done', action === 'approve' ? 'Estimate approved' : action === 'reject' ? 'Estimate rejected' : `Revised to $${amount}`);
      setReviseModal(null);
      fetch();
    } catch (e) { Alert.alert('Error', 'Failed'); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Stats Bar */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.statNum}>{stats.pending_estimates}</Text><Text style={styles.statLabel}>Pending</Text></View>
          <View style={styles.stat}><Text style={[styles.statNum, { color: Colors.accent }]}>${stats.total_pending_value}</Text><Text style={styles.statLabel}>Total Value</Text></View>
          <View style={styles.stat}><Text style={[styles.statNum, { color: Colors.redUrgent }]}>{stats.urgent_issues}</Text><Text style={styles.statLabel}>Urgent</Text></View>
          <View style={styles.stat}><Text style={[styles.statNum, { color: Colors.primary }]}>{stats.total_outstanding_issues}</Text><Text style={styles.statLabel}>Open</Text></View>
        </View>
      )}

      <Text style={styles.sectionTitle}>AI Estimates Awaiting Review</Text>

      <FlatList
        data={queue}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={fetch} tintColor={Colors.primary} />}
        renderItem={({ item: issue }) => {
          const est = issue.ai_estimate || {};
          return (
            <View testID={`review-${issue.id}`} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.priorityTag, { backgroundColor: (PriorityColors[issue.priority] || Colors.grayInactive) + '15' }]}>
                  <Text style={[styles.priorityText, { color: PriorityColors[issue.priority] || Colors.grayInactive }]}>{issue.priority}</Text>
                </View>
                <Text style={styles.tradeType}>{issue.trade_type}</Text>
                {issue.photo_count > 0 && <View style={styles.photoBadge}><Ionicons name="camera" size={12} color={Colors.blueAssigned} /><Text style={styles.photoText}>{issue.photo_count}</Text></View>}
              </View>
              <TouchableOpacity onPress={() => router.push(`/issue/${issue.id}`)}>
                <Text style={styles.cardTitle}>{issue.title}</Text>
              </TouchableOpacity>
              <Text style={styles.cardProp}>{issue.property_name} · {issue.location_in_property}</Text>
              {issue.description ? <Text style={styles.cardDesc} numberOfLines={2}>{issue.description}</Text> : null}

              {/* AI Estimate Details */}
              <View style={styles.estimateBox}>
                <Text style={styles.estimateLabel}>AI Estimate (GPT-5.2)</Text>
                <View style={styles.estimateGrid}>
                  <View style={styles.estItem}><Text style={styles.estValue}>{est.estimated_labor_hours || 0}h</Text><Text style={styles.estLabel}>Labor</Text></View>
                  <View style={styles.estItem}><Text style={styles.estValue}>${est.labor_cost || 0}</Text><Text style={styles.estLabel}>Labor Cost</Text></View>
                  <View style={styles.estItem}><Text style={styles.estValue}>${est.materials_total || 0}</Text><Text style={styles.estLabel}>Materials</Text></View>
                  <View style={styles.estItem}><Text style={[styles.estValue, styles.totalValue]}>${est.total_estimate || issue.estimate_amount || 0}</Text><Text style={styles.estLabel}>Total</Text></View>
                </View>
                {est.reasoning && <Text style={styles.reasoning}>{est.reasoning}</Text>}
                {est.estimated_completion_time && <Text style={styles.completionTime}>Est. time: {est.estimated_completion_time}</Text>}
                <Text style={styles.confidence}>Confidence: {est.confidence || 'N/A'} · Rate: ${est.labor_rate_used || 0}/hr</Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity testID={`approve-${issue.id}`} style={[styles.actionBtn, { backgroundColor: Colors.greenReady }]} onPress={() => handleAction(issue.id, 'approve')}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.actionText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity testID={`revise-${issue.id}`} style={[styles.actionBtn, { backgroundColor: Colors.accent }]} onPress={() => { setReviseModal(issue); setReviseAmount(String(est.total_estimate || issue.estimate_amount || 0)); }}>
                  <Ionicons name="pencil" size={18} color="#fff" />
                  <Text style={styles.actionText}>Revise</Text>
                </TouchableOpacity>
                <TouchableOpacity testID={`reject-${issue.id}`} style={[styles.actionBtn, { backgroundColor: Colors.redUrgent }]} onPress={() => handleAction(issue.id, 'reject')}>
                  <Ionicons name="close" size={18} color="#fff" />
                  <Text style={styles.actionText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.greenReady} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>No estimates awaiting review</Text>
          </View>
        }
      />

      {/* Revise Modal */}
      <Modal visible={!!reviseModal} transparent animationType="fade" onRequestClose={() => setReviseModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Revise Estimate</Text>
            <Text style={styles.modalIssue}>{reviseModal?.title}</Text>
            <Text style={styles.modalLabel}>AI suggested: ${reviseModal?.ai_estimate?.total_estimate || reviseModal?.estimate_amount || 0}</Text>
            <View style={styles.amountRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput testID="revise-amount-input" style={styles.amountInput} value={reviseAmount} onChangeText={setReviseAmount} keyboardType="numeric" />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setReviseModal(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="confirm-revise" style={styles.modalConfirm} onPress={() => handleAction(reviseModal.id, 'revise', parseFloat(reviseAmount))}>
                <Text style={styles.modalConfirmText}>Save Revision</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  statsRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm },
  stat: { flex: 1, backgroundColor: Colors.surface, borderRadius: 10, padding: Spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statNum: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 10, color: Colors.textSecondary },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: Spacing.md },
  list: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 30 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  priorityText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  tradeType: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  photoBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' },
  photoText: { fontSize: 11, fontWeight: '600', color: Colors.blueAssigned },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  cardProp: { fontSize: 13, color: Colors.textSecondary },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  estimateBox: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, padding: Spacing.sm, gap: 6, borderWidth: 1, borderColor: Colors.border },
  estimateLabel: { fontSize: 12, fontWeight: '700', color: Colors.purpleAwaiting },
  estimateGrid: { flexDirection: 'row', gap: 4 },
  estItem: { flex: 1, alignItems: 'center' },
  estValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  totalValue: { color: Colors.primary, fontSize: 18 },
  estLabel: { fontSize: 9, color: Colors.textSecondary },
  reasoning: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 17 },
  completionTime: { fontSize: 11, fontWeight: '600', color: Colors.blueAssigned },
  confidence: { fontSize: 10, color: Colors.grayInactive },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 8 },
  actionText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
  modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, gap: Spacing.md },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalIssue: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  modalLabel: { fontSize: 13, color: Colors.textSecondary },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dollarSign: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '800', color: Colors.textPrimary, backgroundColor: Colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
  modalCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  modalConfirm: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: Colors.primary },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
