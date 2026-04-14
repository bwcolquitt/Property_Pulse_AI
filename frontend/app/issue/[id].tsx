import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, StatusColors, PriorityColors } from '../../src/constants/theme';
import api from '../../src/utils/api';

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const fetchIssue = async () => {
    try {
      const { data } = await api.get(`/issues/${id}`);
      setIssue(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchIssue(); }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.put(`/issues/${id}`, { status: newStatus });
      fetchIssue();
    } catch (e) { console.error(e); }
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await api.post(`/issues/${id}/comments`, { comment_text: comment });
      setComment('');
      fetchIssue();
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!issue) return <View style={styles.loading}><Text>Issue not found</Text></View>;

  const statusColor = StatusColors[issue.status] || Colors.grayInactive;
  const priorityColor = PriorityColors[issue.priority] || Colors.grayInactive;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.tags}>
          <View style={[styles.tag, { backgroundColor: priorityColor + '15' }]}>
            <Text style={[styles.tagText, { color: priorityColor }]}>{issue.priority}</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: statusColor + '15' }]}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.tagText, { color: statusColor }]}>{(issue.status || '').replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <Text style={styles.title}>{issue.title}</Text>
        <Text style={styles.subtitle}>{issue.property?.name} · {issue.location_in_property}</Text>
      </View>

      {/* Alert badges */}
      {(issue.blocks_check_in || issue.guest_impact_level === 'high') && (
        <View style={styles.alertRow}>
          {issue.blocks_check_in && (
            <View style={styles.alertBadge}><Ionicons name="ban" size={16} color={Colors.redUrgent} /><Text style={styles.alertText}>Blocks Check-in</Text></View>
          )}
          {issue.guest_impact_level === 'high' && (
            <View style={[styles.alertBadge, { backgroundColor: Colors.accent + '12' }]}><Ionicons name="people" size={16} color={Colors.accent} /><Text style={[styles.alertText, { color: Colors.accent }]}>High Guest Impact</Text></View>
          )}
        </View>
      )}

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{issue.description}</Text>
      </View>

      {/* Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.detailGrid}>
          {[
            { label: 'Trade Type', value: issue.trade_type },
            { label: 'Source', value: issue.source_type },
            { label: 'Can do during turnover', value: issue.can_be_done_during_turnover ? 'Yes' : 'No' },
            { label: 'Reopened', value: `${issue.reopened_count} time(s)` },
          ].map((d, i) => (
            <View key={i} style={styles.detailItem}>
              <Text style={styles.detailLabel}>{d.label}</Text>
              <Text style={styles.detailValue}>{d.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Estimate */}
      {issue.estimate_amount && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estimate</Text>
          <View style={styles.estimateCard}>
            <Text style={styles.estimateAmount}>${issue.estimate_amount}</Text>
            <View style={[styles.tag, { backgroundColor: (StatusColors[issue.estimate_status] || Colors.grayInactive) + '15' }]}>
              <Text style={[styles.tagText, { color: StatusColors[issue.estimate_status] || Colors.grayInactive }]}>{issue.estimate_status}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Timeline */}
      {issue.status_history?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status History</Text>
          {issue.status_history.map((h: any, i: number) => (
            <View key={i} style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: StatusColors[h.new_status] || Colors.grayInactive }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>{(h.new_status || '').replace(/_/g, ' ')}</Text>
                <Text style={styles.timelineNote}>{h.note}</Text>
                <Text style={styles.timelineDate}>{new Date(h.created_at).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Comments */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Comments ({issue.comments?.length || 0})</Text>
        {issue.comments?.map((c: any, i: number) => (
          <View key={i} style={styles.commentCard}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>{c.user_name}</Text>
              <Text style={styles.commentDate}>{new Date(c.created_at).toLocaleString()}</Text>
            </View>
            <Text style={styles.commentText}>{c.comment_text}</Text>
          </View>
        ))}
        <View style={styles.commentInput}>
          <TextInput
            testID="comment-input"
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor={Colors.grayInactive}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <TouchableOpacity testID="send-comment-btn" style={styles.sendBtn} onPress={handleComment} disabled={sending}>
            {sending ? <ActivityIndicator size="small" color={Colors.primaryForeground} /> : <Ionicons name="send" size={18} color={Colors.primaryForeground} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actionsGrid}>
          {issue.status !== 'completed' && (
            <TouchableOpacity testID="mark-complete-btn" style={[styles.actionBtn, { backgroundColor: Colors.greenReady }]} onPress={() => handleStatusChange('completed')}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Mark Complete</Text>
            </TouchableOpacity>
          )}
          {issue.status === 'completed' && (
            <TouchableOpacity testID="reopen-btn" style={[styles.actionBtn, { backgroundColor: Colors.yellowAtRisk }]} onPress={() => handleStatusChange('reopened')}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Reopen</Text>
            </TouchableOpacity>
          )}
          {issue.status === 'new' && (
            <TouchableOpacity testID="assign-btn" style={[styles.actionBtn, { backgroundColor: Colors.blueAssigned }]} onPress={() => handleStatusChange('assigned')}>
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Assign</Text>
            </TouchableOpacity>
          )}
          {issue.status === 'assigned' && (
            <TouchableOpacity testID="start-btn" style={[styles.actionBtn, { backgroundColor: Colors.blueAssigned }]} onPress={() => handleStatusChange('in_progress')}>
              <Ionicons name="play" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Start Work</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { gap: 6 },
  tags: { flexDirection: 'row', gap: Spacing.sm },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary },
  alertRow: { flexDirection: 'row', gap: Spacing.sm },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.redUrgent + '12', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  alertText: { fontSize: 13, fontWeight: '700', color: Colors.redUrgent },
  section: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  detailItem: { width: '48%', backgroundColor: Colors.surfaceSecondary, borderRadius: 8, padding: Spacing.sm },
  detailLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, textTransform: 'capitalize', marginTop: 2 },
  estimateCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surfaceSecondary, borderRadius: 8, padding: Spacing.md },
  estimateAmount: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  timelineItem: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineContent: { flex: 1 },
  timelineStatus: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, textTransform: 'capitalize' },
  timelineNote: { fontSize: 13, color: Colors.textSecondary },
  timelineDate: { fontSize: 11, color: Colors.grayInactive, marginTop: 2 },
  commentCard: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, padding: Spacing.sm },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  commentDate: { fontSize: 11, color: Colors.grayInactive },
  commentText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  commentInput: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  input: { flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
