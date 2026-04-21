import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking, Modal, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/constants/theme';
import api from '../../src/utils/api';
import { useRouter } from 'expo-router';

const CATEGORIES: { id: string; label: string; icon: string; color: string }[] = [
  { id: 'question', label: 'Question', icon: 'help-circle', color: Colors.primary },
  { id: 'request', label: 'Request', icon: 'hand-right', color: Colors.accent },
  { id: 'problem', label: 'Problem', icon: 'warning', color: Colors.redUrgent },
  { id: 'compliment', label: 'Compliment', icon: 'heart', color: Colors.greenReady },
];

export default function GuestHelpScreen() {
  const router = useRouter();
  const [stay, setStay] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msgModal, setMsgModal] = useState(false);
  const [lostModal, setLostModal] = useState(false);
  const [msgForm, setMsgForm] = useState({ category: 'question', subject: '', body: '' });
  const [lostForm, setLostForm] = useState({ description: '', contact_method: 'email' });
  const [thread, setThread] = useState<any[]>([]);

  useEffect(() => { api.get('/guest-portal/my-stay').then(r => setStay(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);

  useEffect(() => {
    const rid = stay?.reservation?.id;
    if (!rid) return;
    api.get(`/guest-messages/thread/${rid}`).then(r => setThread(r.data)).catch(() => {});
  }, [stay]);

  const hostPhone = stay?.host_phone;
  const emergencyPhone = stay?.emergency_phone || '911';

  const sendMessage = async () => {
    if (!msgForm.subject.trim()) { Alert.alert('Required', 'Add a subject'); return; }
    try {
      const { data } = await api.post('/guest-messages', {
        property_id: stay?.property?.id || '',
        reservation_id: stay?.reservation?.id || '',
        category: msgForm.category,
        subject: msgForm.subject,
        body: msgForm.body,
      });
      Alert.alert('Sent', data.message);
      setMsgModal(false); setMsgForm({ category: 'question', subject: '', body: '' });
      // refresh thread
      const rid = stay?.reservation?.id;
      if (rid) api.get(`/guest-messages/thread/${rid}`).then(r => setThread(r.data)).catch(() => {});
    } catch { Alert.alert('Error', 'Failed to send'); }
  };

  const reportLost = async () => {
    if (!lostForm.description) { Alert.alert('Required', 'Describe what was lost'); return; }
    try {
      const { data } = await api.post('/guest-portal/lost-found', {
        reservation_id: stay?.reservation?.id || '', property_id: stay?.property?.id || '',
        ...lostForm,
      });
      Alert.alert('Submitted', data.message);
      setLostModal(false); setLostForm({ description: '', contact_method: 'email' });
    } catch { Alert.alert('Error', 'Failed'); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Emergency Quick-Dial Bar */}
      <View style={styles.emergBar}>
        <TouchableOpacity style={[styles.emergBtn, { backgroundColor: Colors.redUrgent }]} onPress={() => Linking.openURL('tel:911')}>
          <Ionicons name="alert-circle" size={20} color="#fff" />
          <Text style={styles.emergText}>911</Text>
        </TouchableOpacity>
        {hostPhone && (
          <TouchableOpacity style={[styles.emergBtn, { backgroundColor: Colors.greenReady }]} onPress={() => Linking.openURL(`tel:${hostPhone}`)}>
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.emergText}>Call Host</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Primary: AI Concierge for most things */}
      <TouchableOpacity style={[styles.actionCard, styles.primaryCard]} onPress={() => router.push('/(guest)/explore')}>
        <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '15' }]}><Ionicons name="chatbubble-ellipses" size={24} color={Colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>AI Concierge</Text>
          <Text style={styles.actionSub}>Fastest help: WiFi, checkout, restaurants, activities nearby</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
      </TouchableOpacity>

      {/* Message Host - soft triage, not direct to maintenance */}
      <TouchableOpacity style={styles.actionCard} onPress={() => setMsgModal(true)}>
        <View style={[styles.actionIcon, { backgroundColor: Colors.accent + '15' }]}><Ionicons name="mail" size={24} color={Colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Message Host</Text>
          <Text style={styles.actionSub}>Questions, requests, or something not right? We'll get back to you</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={Colors.grayInactive} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} onPress={() => setLostModal(true)}>
        <View style={[styles.actionIcon, { backgroundColor: Colors.yellowAtRisk + '15' }]}><Ionicons name="search" size={24} color={Colors.yellowAtRisk} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Lost & Found</Text>
          <Text style={styles.actionSub}>Left something behind? We'll look for it</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={Colors.grayInactive} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(guest)/guide')}>
        <View style={[styles.actionIcon, { backgroundColor: Colors.greenReady + '15' }]}><Ionicons name="book" size={24} color={Colors.greenReady} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Property Guide</Text>
          <Text style={styles.actionSub}>House rules, check-out instructions, WiFi info</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={Colors.grayInactive} />
      </TouchableOpacity>

      {/* Message Thread */}
      {thread.length > 0 && (
        <View style={styles.threadBox}>
          <Text style={styles.threadTitle}>Your Messages</Text>
          {thread.map(m => (
            <View key={m.id} style={styles.threadItem}>
              <View style={styles.threadHead}>
                <Text style={styles.threadSubject}>{m.subject}</Text>
                <View style={[styles.statusPill, { backgroundColor: (m.status === 'replied' ? Colors.greenReady : m.status === 'new' ? Colors.yellowAtRisk : Colors.blueAssigned) + '20' }]}>
                  <Text style={[styles.statusText, { color: m.status === 'replied' ? Colors.greenReady : m.status === 'new' ? Colors.yellowAtRisk : Colors.blueAssigned }]}>{m.status}</Text>
                </View>
              </View>
              <Text style={styles.threadBody} numberOfLines={2}>{m.body}</Text>
              {m.host_reply && (
                <View style={styles.hostReply}>
                  <Text style={styles.hostReplyLabel}>Host replied:</Text>
                  <Text style={styles.hostReplyText}>{m.host_reply}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Guest Inventory Warning */}
      {stay?.guest_inventory?.length > 0 && (
        <View style={styles.inventoryCard}>
          <View style={styles.inventoryHead}><Ionicons name="pricetag" size={18} color={Colors.accent} /><Text style={styles.inventoryTitle}>Property Inventory</Text></View>
          <Text style={styles.inventoryHint}>Items below have replacement charges if missing at checkout</Text>
          {stay.guest_inventory.slice(0, 5).map((item: any, i: number) => (
            <View key={i} style={styles.invRow}>
              <Text style={styles.invName}>{item.name}</Text>
              <Text style={styles.invCost}>${item.replacement_cost} x{item.quantity}</Text>
            </View>
          ))}
          {stay.guest_inventory.length > 5 && <Text style={styles.invMore}>+{stay.guest_inventory.length - 5} more items</Text>}
        </View>
      )}

      {/* Message Modal */}
      <Modal visible={msgModal} transparent animationType="slide" onRequestClose={() => setMsgModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.modal}>
              <Text style={styles.modalTitle}>Message Host</Text>
              <Text style={styles.modalHint}>The host will read your message and respond. This is NOT an emergency line.</Text>
              <Text style={styles.label}>Category</Text>
              <View style={styles.catRow}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity key={c.id} style={[styles.catBtn, msgForm.category === c.id && { backgroundColor: c.color, borderColor: c.color }]} onPress={() => setMsgForm({ ...msgForm, category: c.id })}>
                    <Ionicons name={c.icon as any} size={16} color={msgForm.category === c.id ? '#fff' : c.color} />
                    <Text style={[styles.catText, msgForm.category === c.id && { color: '#fff' }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Subject</Text>
              <TextInput style={styles.input} value={msgForm.subject} onChangeText={v => setMsgForm({ ...msgForm, subject: v })} placeholder="Brief summary" placeholderTextColor={Colors.grayInactive} />
              <Text style={styles.label}>Message</Text>
              <TextInput style={[styles.input, { height: 100 }]} value={msgForm.body} onChangeText={v => setMsgForm({ ...msgForm, body: v })} placeholder="Details..." multiline textAlignVertical="top" placeholderTextColor={Colors.grayInactive} />
              <TouchableOpacity style={styles.submitBtn} onPress={sendMessage}><Ionicons name="send" size={16} color="#fff" /><Text style={styles.submitText}>Send to Host</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setMsgModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            </View></ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Lost & Found Modal */}
      <Modal visible={lostModal} transparent animationType="fade" onRequestClose={() => setLostModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}><View style={styles.modal}>
            <Text style={styles.modalTitle}>Lost & Found</Text>
            <TextInput style={[styles.input, { height: 80 }]} value={lostForm.description} onChangeText={v => setLostForm({ ...lostForm, description: v })} placeholder="Describe what you left behind..." multiline textAlignVertical="top" placeholderTextColor={Colors.grayInactive} />
            <TouchableOpacity style={styles.submitBtn} onPress={reportLost}><Text style={styles.submitText}>Submit Report</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setLostModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View></View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  emergBar: { flexDirection: 'row', gap: Spacing.sm },
  emergBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12 },
  emergText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  primaryCard: { borderColor: Colors.primary + '40', borderWidth: 1.5, backgroundColor: Colors.primary + '05' },
  actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  actionSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  // Thread
  threadBox: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  threadTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  threadItem: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  threadHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  threadSubject: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  threadBody: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  hostReply: { backgroundColor: Colors.greenReady + '10', borderRadius: 8, padding: 8, marginTop: 6, borderLeftWidth: 3, borderLeftColor: Colors.greenReady },
  hostReplyLabel: { fontSize: 10, fontWeight: '700', color: Colors.greenReady, textTransform: 'uppercase' },
  hostReplyText: { fontSize: 12, color: Colors.textPrimary, marginTop: 2, lineHeight: 16 },
  // Inventory
  inventoryCard: { backgroundColor: Colors.accent + '08', borderRadius: 14, padding: Spacing.md, borderWidth: 1, borderColor: Colors.accent + '25', gap: 6 },
  inventoryHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inventoryTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  inventoryHint: { fontSize: 12, color: Colors.accent, fontWeight: '600' },
  invRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: Colors.accent + '15' },
  invName: { fontSize: 13, color: Colors.textPrimary },
  invCost: { fontSize: 13, fontWeight: '700', color: Colors.accent },
  invMore: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.md },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalHint: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase', marginTop: 6 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  catText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 10, backgroundColor: Colors.primary, marginTop: 6 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, paddingVertical: 8, textAlign: 'center' },
});
