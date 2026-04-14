import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, RefreshControl, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const JOB_TYPES = ['cleaning', 'maintenance', 'pool', 'deep_clean'];
const URGENCY_LEVELS = ['normal', 'urgent', 'emergency'];
const TYPE_COLORS: Record<string, string> = { cleaning: Colors.purpleAwaiting, maintenance: Colors.primary, pool: Colors.secondary, deep_clean: Colors.accent };
const URGENCY_COLORS: Record<string, string> = { normal: Colors.greenReady, urgent: Colors.yellowAtRisk, emergency: Colors.redUrgent };
const STATUS_COLORS: Record<string, string> = { open: Colors.blueAssigned, awarded: Colors.greenReady, closed: Colors.grayInactive };

export default function JobBoardScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [form, setForm] = useState({ property_id: '', title: '', description: '', job_type: 'cleaning', urgency: 'normal', budget_min: '', budget_max: '', requirements: '' });
  const [bidForm, setBidForm] = useState({ amount: '', estimated_hours: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const params: any = {};
      if (filter !== 'all') params.status = filter;
      const { data } = await api.get('/jobs', { params });
      setJobs(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => { api.get('/properties').then(r => setProperties(r.data)).catch(() => {}); }, []);

  const createJob = async () => {
    if (!form.property_id || !form.title) { Alert.alert('Required', 'Select a property and enter a title'); return; }
    setSubmitting(true);
    try {
      await api.post('/jobs', {
        ...form,
        budget_min: form.budget_min ? parseFloat(form.budget_min) : null,
        budget_max: form.budget_max ? parseFloat(form.budget_max) : null,
      });
      Alert.alert('Posted', 'Job posted to marketplace');
      setCreateModal(false);
      setForm({ property_id: '', title: '', description: '', job_type: 'cleaning', urgency: 'normal', budget_min: '', budget_max: '', requirements: '' });
      fetchJobs();
    } catch { Alert.alert('Error', 'Failed to create job'); }
    finally { setSubmitting(false); }
  };

  const openDetail = async (jobId: string) => {
    try {
      const { data } = await api.get(`/jobs/${jobId}`);
      setDetailModal(data);
    } catch { Alert.alert('Error', 'Failed to load job'); }
  };

  const submitBid = async () => {
    if (!bidForm.amount) { Alert.alert('Required', 'Enter bid amount'); return; }
    try {
      await api.post(`/jobs/${detailModal.id}/bids`, {
        amount: parseFloat(bidForm.amount),
        estimated_hours: parseFloat(bidForm.estimated_hours) || 0,
        message: bidForm.message,
      });
      Alert.alert('Bid Submitted');
      setBidForm({ amount: '', estimated_hours: '', message: '' });
      openDetail(detailModal.id);
    } catch { Alert.alert('Error', 'Failed to submit bid'); }
  };

  const actionBid = async (bidId: string, action: string) => {
    try {
      await api.put(`/jobs/${detailModal.id}/bids/${bidId}`, { action });
      Alert.alert('Done', `Bid ${action}ed`);
      openDetail(detailModal.id);
    } catch { Alert.alert('Error', 'Failed'); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Filters */}
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={['all', 'open', 'awarded', 'closed']} keyExtractor={f => f} contentContainerStyle={styles.filterRow}
        renderItem={({ item: f }) => (
          <TouchableOpacity style={[styles.filterBtn, filter === f && styles.filterActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f === 'all' ? 'All Jobs' : f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Job List */}
      <FlatList data={jobs} keyExtractor={j => j.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} tintColor={Colors.primary} />}
        renderItem={({ item: job }) => {
          const typeColor = TYPE_COLORS[job.job_type] || Colors.grayInactive;
          const urgColor = URGENCY_COLORS[job.urgency] || Colors.grayInactive;
          const statColor = STATUS_COLORS[job.status] || Colors.grayInactive;
          return (
            <TouchableOpacity style={styles.jobCard} onPress={() => openDetail(job.id)}>
              <View style={[styles.jobStripe, { backgroundColor: typeColor }]} />
              <View style={styles.jobBody}>
                <View style={styles.jobTop}>
                  <View style={[styles.badge, { backgroundColor: typeColor + '15' }]}><Text style={[styles.badgeText, { color: typeColor }]}>{job.job_type.replace(/_/g, ' ')}</Text></View>
                  <View style={[styles.badge, { backgroundColor: urgColor + '15' }]}><Text style={[styles.badgeText, { color: urgColor }]}>{job.urgency}</Text></View>
                  <View style={[styles.badge, { backgroundColor: statColor + '15' }]}><Text style={[styles.badgeText, { color: statColor }]}>{job.status}</Text></View>
                </View>
                <Text style={styles.jobTitle}>{job.title}</Text>
                <Text style={styles.jobProp}>{job.property_name}</Text>
                {job.description ? <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text> : null}
                <View style={styles.jobMeta}>
                  {(job.budget_min || job.budget_max) && (
                    <View style={styles.metaItem}><Ionicons name="cash" size={14} color={Colors.accent} /><Text style={styles.metaText}>${job.budget_min || '?'} - ${job.budget_max || '?'}</Text></View>
                  )}
                  <View style={styles.metaItem}><Ionicons name="chatbubbles" size={14} color={Colors.blueAssigned} /><Text style={styles.metaText}>{job.bid_count || 0} bid{(job.bid_count || 0) !== 1 ? 's' : ''}</Text></View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="briefcase-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No jobs posted yet</Text></View>}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setCreateModal(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}><ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.modal}>
          <Text style={styles.modalTitle}>Post a Job</Text>
          
          <Text style={styles.label}>Property *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.chipRow}>
            {properties.map(p => (
              <TouchableOpacity key={p.id} style={[styles.chip, form.property_id === p.id && styles.chipActive]} onPress={() => setForm({ ...form, property_id: p.id })}>
                <Text style={[styles.chipText, form.property_id === p.id && { color: '#fff' }]}>{p.nickname || p.name}</Text>
              </TouchableOpacity>
            ))}
          </View></ScrollView>

          <Text style={styles.label}>Job Title *</Text>
          <TextInput style={styles.input} value={form.title} onChangeText={v => setForm({ ...form, title: v })} placeholder="e.g., Deep clean after pet stay" placeholderTextColor={Colors.grayInactive} />

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, { height: 80 }]} value={form.description} onChangeText={v => setForm({ ...form, description: v })} placeholder="Details about the job..." multiline placeholderTextColor={Colors.grayInactive} />

          <Text style={styles.label}>Type</Text>
          <View style={styles.chipRow}>
            {JOB_TYPES.map(t => (
              <TouchableOpacity key={t} style={[styles.chip, form.job_type === t && { backgroundColor: TYPE_COLORS[t], borderColor: TYPE_COLORS[t] }]} onPress={() => setForm({ ...form, job_type: t })}>
                <Text style={[styles.chipText, form.job_type === t && { color: '#fff' }]}>{t.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Urgency</Text>
          <View style={styles.chipRow}>
            {URGENCY_LEVELS.map(u => (
              <TouchableOpacity key={u} style={[styles.chip, form.urgency === u && { backgroundColor: URGENCY_COLORS[u], borderColor: URGENCY_COLORS[u] }]} onPress={() => setForm({ ...form, urgency: u })}>
                <Text style={[styles.chipText, form.urgency === u && { color: '#fff' }]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Budget Range</Text>
          <View style={styles.budgetRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={form.budget_min} onChangeText={v => setForm({ ...form, budget_min: v })} placeholder="Min $" keyboardType="numeric" placeholderTextColor={Colors.grayInactive} />
            <Text style={styles.budgetDash}>—</Text>
            <TextInput style={[styles.input, { flex: 1 }]} value={form.budget_max} onChangeText={v => setForm({ ...form, budget_max: v })} placeholder="Max $" keyboardType="numeric" placeholderTextColor={Colors.grayInactive} />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={createJob} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <><Ionicons name="megaphone" size={18} color="#fff" /><Text style={styles.saveText}>Post Job</Text></>}
            </TouchableOpacity>
          </View>
        </View></ScrollView></View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!detailModal} transparent animationType="slide" onRequestClose={() => setDetailModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}><ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.modal}>
          {detailModal && (<>
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{detailModal.title}</Text>
                <Text style={styles.detailProp}>{detailModal.property_name}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[detailModal.status] || Colors.grayInactive) + '15' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLORS[detailModal.status] || Colors.grayInactive }]}>{detailModal.status}</Text>
              </View>
            </View>

            {detailModal.description ? <Text style={styles.detailDesc}>{detailModal.description}</Text> : null}

            <View style={styles.detailMeta}>
              <View style={styles.metaItem}><Ionicons name="construct" size={14} color={Colors.textSecondary} /><Text style={styles.metaText}>{detailModal.job_type?.replace(/_/g, ' ')}</Text></View>
              <View style={styles.metaItem}><Ionicons name="flash" size={14} color={URGENCY_COLORS[detailModal.urgency] || Colors.grayInactive} /><Text style={styles.metaText}>{detailModal.urgency}</Text></View>
              {(detailModal.budget_min || detailModal.budget_max) && (
                <View style={styles.metaItem}><Ionicons name="cash" size={14} color={Colors.accent} /><Text style={styles.metaText}>${detailModal.budget_min || '?'} - ${detailModal.budget_max || '?'}</Text></View>
              )}
            </View>

            {/* Bids */}
            <Text style={styles.sectionTitle}>Bids ({detailModal.bids?.length || 0})</Text>
            {(detailModal.bids || []).map((bid: any) => (
              <View key={bid.id} style={[styles.bidCard, bid.status === 'accepted' && { borderColor: Colors.greenReady }]}>
                <View style={styles.bidHeader}>
                  <Text style={styles.bidder}>{bid.provider_name || bid.bidder_name}</Text>
                  <Text style={styles.bidAmount}>${bid.amount}</Text>
                </View>
                {bid.message ? <Text style={styles.bidMsg}>{bid.message}</Text> : null}
                {bid.estimated_hours > 0 && <Text style={styles.bidHours}>Est. {bid.estimated_hours}h</Text>}
                <View style={[styles.bidStatus, { backgroundColor: (bid.status === 'accepted' ? Colors.greenReady : bid.status === 'rejected' ? Colors.redUrgent : Colors.yellowAtRisk) + '15' }]}>
                  <Text style={[styles.bidStatusText, { color: bid.status === 'accepted' ? Colors.greenReady : bid.status === 'rejected' ? Colors.redUrgent : Colors.yellowAtRisk }]}>{bid.status}</Text>
                </View>
                {bid.status === 'pending' && detailModal.status === 'open' && (
                  <View style={styles.bidActions}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => actionBid(bid.id, 'accept')}><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.acceptText}>Accept</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => actionBid(bid.id, 'reject')}><Text style={styles.rejectText}>Reject</Text></TouchableOpacity>
                  </View>
                )}
              </View>
            ))}

            {/* Submit Bid */}
            {detailModal.status === 'open' && (
              <View style={styles.bidForm}>
                <Text style={styles.sectionTitle}>Submit a Bid</Text>
                <View style={styles.bidInputRow}>
                  <TextInput style={[styles.input, { flex: 1 }]} value={bidForm.amount} onChangeText={v => setBidForm({ ...bidForm, amount: v })} placeholder="Amount $" keyboardType="numeric" placeholderTextColor={Colors.grayInactive} />
                  <TextInput style={[styles.input, { flex: 1 }]} value={bidForm.estimated_hours} onChangeText={v => setBidForm({ ...bidForm, estimated_hours: v })} placeholder="Hours" keyboardType="numeric" placeholderTextColor={Colors.grayInactive} />
                </View>
                <TextInput style={styles.input} value={bidForm.message} onChangeText={v => setBidForm({ ...bidForm, message: v })} placeholder="Message..." placeholderTextColor={Colors.grayInactive} />
                <TouchableOpacity style={styles.submitBidBtn} onPress={submitBid}><Ionicons name="send" size={16} color="#fff" /><Text style={styles.submitBidText}>Submit Bid</Text></TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailModal(null)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
          </>)}
        </View></ScrollView></View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  jobCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  jobStripe: { width: 4 },
  jobBody: { flex: 1, padding: Spacing.md, gap: 6 },
  jobTop: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  jobTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  jobProp: { fontSize: 13, color: Colors.textSecondary },
  jobDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  jobMeta: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '95%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  budgetDash: { fontSize: 18, color: Colors.grayInactive },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: Colors.primary },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // Detail
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  detailProp: { fontSize: 14, color: Colors.textSecondary },
  detailDesc: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  detailMeta: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 8 },
  bidCard: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, padding: Spacing.sm, gap: 4, borderWidth: 1, borderColor: Colors.border },
  bidHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bidder: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  bidAmount: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  bidMsg: { fontSize: 13, color: Colors.textSecondary },
  bidHours: { fontSize: 12, color: Colors.textSecondary },
  bidStatus: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  bidStatusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  bidActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.greenReady },
  acceptText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  rejectBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.redUrgent },
  rejectText: { fontSize: 13, fontWeight: '700', color: Colors.redUrgent },
  bidForm: { gap: Spacing.sm, padding: Spacing.sm, backgroundColor: Colors.primary + '08', borderRadius: 10, marginTop: 4 },
  bidInputRow: { flexDirection: 'row', gap: Spacing.sm },
  submitBidBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.accent },
  submitBidText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  closeBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginTop: 8 },
  closeText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
});
