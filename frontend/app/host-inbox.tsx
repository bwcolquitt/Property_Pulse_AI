import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const FILTERS: { id: string; label: string; color?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New', color: Colors.redUrgent },
  { id: 'replied', label: 'Replied', color: Colors.blueAssigned },
  { id: 'converted', label: 'Issues', color: Colors.accent },
  { id: 'resolved', label: 'Resolved', color: Colors.greenReady },
];

const CATEGORY_ICON: Record<string, string> = { question: 'help-circle', request: 'hand-right', problem: 'warning', compliment: 'heart' };

export default function HostInboxScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ new: 0, replied: 0, converted: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [convertModal, setConvertModal] = useState(false);
  const [convertForm, setConvertForm] = useState({ trade_type: 'general', priority: 'medium', notes: '' });

  const fetchData = useCallback(async () => {
    try {
      const params: any = {};
      if (filter !== 'all') params.status = filter;
      const [mRes, sRes] = await Promise.all([api.get('/guest-messages', { params }), api.get('/guest-messages/stats')]);
      setMessages(mRes.data);
      setStats(sRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sendReply = async () => {
    if (!replyText.trim()) return;
    try {
      await api.put(`/guest-messages/${selected.id}/reply`, { reply: replyText });
      Alert.alert('Sent', 'Reply delivered to guest.');
      setReplyText(''); setSelected(null); fetchData();
    } catch { Alert.alert('Error', 'Failed to reply'); }
  };

  const convertToIssue = async () => {
    try {
      const { data } = await api.put(`/guest-messages/${selected.id}/convert-to-issue`, convertForm);
      Alert.alert('Converted', `Created maintenance issue.`);
      setConvertModal(false); setSelected(null); fetchData();
    } catch { Alert.alert('Error', 'Failed to convert'); }
  };

  const resolveMsg = (msg: any) => {
    Alert.alert('Resolve?', 'Mark as resolved (no action needed).', [
      { text: 'Cancel' },
      { text: 'Resolve', onPress: async () => { await api.put(`/guest-messages/${msg.id}/resolve`, {}); fetchData(); } },
    ]);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={[styles.statNum, { color: Colors.redUrgent }]}>{stats.new}</Text><Text style={styles.statLabel}>New</Text></View>
        <View style={styles.statCard}><Text style={[styles.statNum, { color: Colors.blueAssigned }]}>{stats.replied}</Text><Text style={styles.statLabel}>Replied</Text></View>
        <View style={styles.statCard}><Text style={[styles.statNum, { color: Colors.accent }]}>{stats.converted}</Text><Text style={styles.statLabel}>Issues</Text></View>
        <View style={styles.statCard}><Text style={[styles.statNum, { color: Colors.greenReady }]}>{stats.resolved}</Text><Text style={styles.statLabel}>Resolved</Text></View>
      </View>

      {/* Filter */}
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={FILTERS} keyExtractor={i => i.id} contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.filterBtn, filter === item.id && styles.filterActive]} onPress={() => setFilter(item.id)}>
            <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />

      {/* List */}
      <FlatList
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="chatbubbles-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No guest messages</Text></View>}
        renderItem={({ item }) => {
          const statusColor = item.status === 'new' ? Colors.redUrgent : item.status === 'replied' ? Colors.blueAssigned : item.status === 'converted' ? Colors.accent : Colors.greenReady;
          const catIcon = (CATEGORY_ICON[item.category] || 'mail') as any;
          return (
            <TouchableOpacity style={styles.card} onPress={() => { setSelected(item); setReplyText(item.host_reply || ''); }}>
              <View style={[styles.iconBox, { backgroundColor: statusColor + '15' }]}>
                <Ionicons name={catIcon} size={20} color={statusColor} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardHead}>
                  <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
                  <View style={[styles.statusPill, { backgroundColor: statusColor + '15' }]}><Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text></View>
                </View>
                <Text style={styles.meta} numberOfLines={1}>{item.guest_name} · {item.property_name || 'Property'}</Text>
                <Text style={styles.preview} numberOfLines={2}>{item.body}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Message Detail Modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.modal}>
                {selected && (
                  <>
                    <View style={styles.mHead}>
                      <Text style={styles.mSubject}>{selected.subject}</Text>
                      <TouchableOpacity onPress={() => setSelected(null)}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
                    </View>
                    <Text style={styles.mMeta}>{selected.guest_name} · {selected.guest_email}</Text>
                    <Text style={styles.mMeta}>{selected.property_name} · {new Date(selected.created_at).toLocaleString()}</Text>
                    <View style={styles.mBodyBox}>
                      <Text style={styles.mBody}>{selected.body}</Text>
                    </View>

                    {selected.status === 'replied' && selected.host_reply ? (
                      <View style={styles.replyBox}>
                        <Text style={styles.replyLabel}>Your reply:</Text>
                        <Text style={styles.replyText}>{selected.host_reply}</Text>
                      </View>
                    ) : null}

                    {selected.converted_issue_id ? (
                      <View style={styles.convertedBox}>
                        <Ionicons name="construct" size={18} color={Colors.accent} />
                        <Text style={styles.convertedText}>Converted to maintenance issue</Text>
                      </View>
                    ) : null}

                    {selected.status !== 'resolved' && (
                      <>
                        <Text style={styles.label}>Reply to guest</Text>
                        <TextInput
                          style={[styles.input, { height: 80 }]}
                          multiline
                          value={replyText}
                          onChangeText={setReplyText}
                          placeholder="Type a quick response..."
                          placeholderTextColor={Colors.grayInactive}
                        />
                        <TouchableOpacity style={styles.replyBtn} onPress={sendReply}>
                          <Ionicons name="send" size={16} color="#fff" />
                          <Text style={styles.replyBtnText}>Send Reply</Text>
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <View style={styles.actionRow}>
                          {!selected.converted_issue_id && (
                            <TouchableOpacity style={styles.convertBtn} onPress={() => setConvertModal(true)}>
                              <Ionicons name="construct" size={16} color="#fff" />
                              <Text style={styles.convertText}>Convert to Issue</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={styles.resolveBtn} onPress={() => { resolveMsg(selected); setSelected(null); }}>
                            <Ionicons name="checkmark-circle" size={16} color={Colors.greenReady} />
                            <Text style={styles.resolveText}>Mark Resolved</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Convert Modal */}
      <Modal visible={convertModal} transparent animationType="fade" onRequestClose={() => setConvertModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalInner}>
            <Text style={styles.modalTitle}>Convert to Maintenance Issue</Text>
            <Text style={styles.label}>Trade</Text>
            <View style={styles.chipRow}>
              {['general', 'plumbing', 'electrical', 'hvac', 'appliance', 'pool', 'other'].map(t => (
                <TouchableOpacity key={t} style={[styles.chip, convertForm.trade_type === t && styles.chipActive]} onPress={() => setConvertForm({ ...convertForm, trade_type: t })}>
                  <Text style={[styles.chipText, convertForm.trade_type === t && { color: '#fff' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Priority</Text>
            <View style={styles.chipRow}>
              {['low', 'medium', 'high', 'urgent'].map(p => {
                const colorMap: Record<string, string> = { low: Colors.grayInactive, medium: Colors.yellowAtRisk, high: Colors.accent, urgent: Colors.redUrgent };
                return (
                  <TouchableOpacity key={p} style={[styles.chip, convertForm.priority === p && { backgroundColor: colorMap[p], borderColor: colorMap[p] }]} onPress={() => setConvertForm({ ...convertForm, priority: p })}>
                    <Text style={[styles.chipText, convertForm.priority === p && { color: '#fff' }]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.label}>Host notes (optional)</Text>
            <TextInput style={[styles.input, { height: 60 }]} multiline value={convertForm.notes} onChangeText={v => setConvertForm({ ...convertForm, notes: v })} placeholder="Additional context for maintenance..." placeholderTextColor={Colors.grayInactive} />
            <View style={styles.mActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConvertModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={convertToIssue}><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.saveText}>Create Issue</Text></TouchableOpacity>
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
  statsRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  statNum: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase' },
  filterRow: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  card: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  subject: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  meta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  preview: { fontSize: 13, color: Colors.textPrimary, marginTop: 4, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.md },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, gap: Spacing.sm },
  modalInner: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  mHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mSubject: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  mMeta: { fontSize: 12, color: Colors.textSecondary },
  mBodyBox: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, padding: Spacing.md, marginTop: 4 },
  mBody: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  replyBox: { backgroundColor: Colors.blueAssigned + '10', borderRadius: 10, padding: Spacing.md, borderLeftWidth: 3, borderLeftColor: Colors.blueAssigned },
  replyLabel: { fontSize: 11, fontWeight: '700', color: Colors.blueAssigned, textTransform: 'uppercase' },
  replyText: { fontSize: 13, color: Colors.textPrimary, marginTop: 4, lineHeight: 18 },
  convertedBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent + '10', borderRadius: 10, padding: Spacing.sm },
  convertedText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, marginTop: 8, textTransform: 'uppercase' },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary, textAlignVertical: 'top' },
  replyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary, marginTop: 8 },
  replyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  convertBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.accent },
  convertText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  resolveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.greenReady, backgroundColor: Colors.greenReady + '10' },
  resolveText: { fontSize: 13, fontWeight: '700', color: Colors.greenReady },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  mActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: Colors.accent },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
