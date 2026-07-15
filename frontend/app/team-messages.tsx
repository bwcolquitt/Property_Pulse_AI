/**
 * Team Messages — In-app communication hub for property managers, cleaners, maintenance, and trades.
 *
 * Features:
 *  - Conversation list with unread badges + last-message preview
 *  - Create new 1-to-1 or group conversations (user picker modal)
 *  - Thread view with text + photo + voice note messages
 *  - Long-press message → "Convert to Task" modal (assign to any teammate)
 *  - Quick checkbox on incoming messages for one-tap task conversion
 *  - Property tag per conversation/message
 *  - Polls for new messages every 5 seconds
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput,
  Modal, ScrollView, Alert, Image, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const ROLE_COLORS: Record<string, string> = {
  property_manager: Colors.primary,
  admin: Colors.primary,
  cleaner: Colors.purpleAwaiting,
  maintenance: Colors.accent,
  vendor: Colors.secondary,
  guest: Colors.grayInactive,
};

const ROLE_ICONS: Record<string, string> = {
  property_manager: 'briefcase',
  admin: 'briefcase',
  cleaner: 'sparkles',
  maintenance: 'construct',
  vendor: 'people',
  guest: 'person',
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: Colors.grayInactive },
  { value: 'medium', label: 'Medium', color: Colors.blueAssigned },
  { value: 'high', label: 'High', color: Colors.yellowAtRisk },
  { value: 'urgent', label: 'Urgent', color: Colors.redUrgent },
];

const TRADE_OPTIONS = [
  { value: 'general', label: 'General', icon: 'hammer' },
  { value: 'cleaning', label: 'Cleaning', icon: 'sparkles' },
  { value: 'maintenance', label: 'Maintenance', icon: 'construct' },
  { value: 'plumbing', label: 'Plumbing', icon: 'water' },
  { value: 'electrical', label: 'Electrical', icon: 'flash' },
  { value: 'hvac', label: 'HVAC', icon: 'thermometer' },
];

interface Teammate { id: string; first_name: string; last_name: string; email: string; role: string; }
interface Conversation { id: string; conversation_type: string; name: string; property_name?: string; participants: any[]; participant_names: string[]; last_message: any; unread_count: number; }
interface Message { id: string; body: string; message_type: string; attachment_base64?: string; attachment_mime?: string; sender_name?: string; sender_role?: string; is_me: boolean; created_at: string; converted_to_task_id?: string; sender_user_id?: string; }

export default function TeamMessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [team, setTeam] = useState<Teammate[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newMsg, setNewMsg] = useState('');
  const [attachment, setAttachment] = useState<{ base64: string; mime: string } | null>(null);
  const [sending, setSending] = useState(false);

  const [showNewConv, setShowNewConv] = useState(false);
  const [pickedUserIds, setPickedUserIds] = useState<string[]>([]);
  const [pickedProperty, setPickedProperty] = useState<string>('');
  const [groupName, setGroupName] = useState('');

  const [taskModal, setTaskModal] = useState<Message | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskTrade, setTaskTrade] = useState('general');
  const [taskProperty, setTaskProperty] = useState('');

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const listRef = useRef<FlatList>(null);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/messages/conversations');
      setConversations(data);
    } catch (e: any) { console.error('convs load:', e?.response?.data || e); }
    finally { setLoading(false); }
  }, []);

  const loadTeamAndProps = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([api.get('/messages/team'), api.get('/properties')]);
      setTeam(t.data || []);
      setProperties(p.data || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadMessages = useCallback(async (convId: string, silent = false) => {
    try {
      const { data } = await api.get(`/messages/conversations/${convId}`);
      setMessages(data);
      if (!silent) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadConversations(); loadTeamAndProps(); }, [loadConversations, loadTeamAndProps]);

  // Poll for new messages when a conversation is open
  useEffect(() => {
    if (selectedConv) {
      pollRef.current = setInterval(() => loadMessages(selectedConv.id, true), 5000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [selectedConv, loadMessages]);

  const openConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    await loadMessages(conv.id);
    loadConversations();  // refresh unread counts
  };

  const attachPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Please allow photo access'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true });
    if (!res.canceled && res.assets[0]?.base64) {
      setAttachment({ base64: res.assets[0].base64, mime: 'image/jpeg' });
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Please allow camera access'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
    if (!res.canceled && res.assets[0]?.base64) {
      setAttachment({ base64: res.assets[0].base64, mime: 'image/jpeg' });
    }
  };

  const sendMessage = async () => {
    if ((!newMsg.trim() && !attachment) || !selectedConv || sending) return;
    setSending(true);
    try {
      await api.post(`/messages/conversations/${selectedConv.id}`, {
        body: newMsg,
        message_type: attachment ? 'photo' : 'text',
        attachment_base64: attachment?.base64,
        attachment_mime: attachment?.mime,
      });
      setNewMsg(''); setAttachment(null);
      await loadMessages(selectedConv.id);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Try again');
    } finally { setSending(false); }
  };

  const createConversation = async () => {
    if (pickedUserIds.length === 0) { Alert.alert('Pick someone', 'Select at least one teammate'); return; }
    const isGroup = pickedUserIds.length > 1;
    try {
      const { data } = await api.post('/messages/conversations', {
        participant_ids: pickedUserIds,
        conversation_type: isGroup ? 'group' : 'direct',
        name: isGroup ? (groupName || 'Team Chat') : '',
        property_id: pickedProperty || null,
      });
      setShowNewConv(false);
      setPickedUserIds([]); setGroupName(''); setPickedProperty('');
      await loadConversations();
      // Auto-open the new conversation
      const conv = { id: data.id, ...data } as any;
      // Ensure participants are populated by re-fetching
      const { data: convs } = await api.get('/messages/conversations');
      const found = convs.find((c: any) => c.id === data.id);
      if (found) openConversation(found);
      else openConversation(conv);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Try again');
    }
  };

  const openTaskModal = (msg: Message) => {
    setTaskModal(msg);
    setTaskTitle(msg.body.slice(0, 60));
    setTaskAssignee(msg.is_me ? (selectedConv?.participants || []).find((p: any) => !p.is_me)?.id || '' : msg.sender_user_id || '');
    setTaskProperty(pickedProperty || '');
    setTaskPriority('medium');
    setTaskTrade('general');
  };

  const convertToTask = async () => {
    if (!taskModal || !taskAssignee || !taskTitle.trim()) {
      Alert.alert('Missing fields', 'Please pick an assignee and enter a title');
      return;
    }
    try {
      await api.post(`/messages/${taskModal.id}/convert-to-task`, {
        assignee_user_id: taskAssignee,
        title: taskTitle,
        priority: taskPriority,
        property_id: taskProperty || null,
        trade_type: taskTrade,
      });
      Alert.alert('Task Created ✅', 'The task has been added to their to-do list.');
      setTaskModal(null);
      if (selectedConv) loadMessages(selectedConv.id);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Try again');
    }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  // ==================== THREAD VIEW ====================
  if (selectedConv) {
    const title = selectedConv.conversation_type === 'group'
      ? (selectedConv.name || selectedConv.participant_names.join(', '))
      : selectedConv.participant_names[0] || 'Chat';
    const subtitle = selectedConv.conversation_type === 'group'
      ? `${selectedConv.participants.length} people`
      : (selectedConv.participants.find((p: any) => !p.is_me)?.role || '').replace(/_/g, ' ');

    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.threadHeader}>
          <TouchableOpacity onPress={() => { setSelectedConv(null); loadConversations(); }} testID="back-to-conv-list">
            <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.threadHeaderAvatar}>
            <Ionicons name={selectedConv.conversation_type === 'group' ? 'people' : 'person'} size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.threadTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.threadSub} numberOfLines={1}>
              {selectedConv.property_name ? `📍 ${selectedConv.property_name} · ` : ''}{subtitle}
            </Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: m }) => (
            <Pressable
              onLongPress={() => openTaskModal(m)}
              delayLongPress={400}
              style={[styles.msgBubble, m.is_me ? styles.msgMe : styles.msgThem]}
            >
              {!m.is_me && (
                <View style={styles.msgSenderRow}>
                  <Ionicons name={(ROLE_ICONS[m.sender_role || ''] || 'person') as any} size={11} color={ROLE_COLORS[m.sender_role || ''] || Colors.textSecondary} />
                  <Text style={[styles.msgSender, { color: ROLE_COLORS[m.sender_role || ''] || Colors.textSecondary }]}>{m.sender_name}</Text>
                </View>
              )}
              {m.attachment_base64 ? (
                <Image source={{ uri: `data:${m.attachment_mime};base64,${m.attachment_base64}` }} style={styles.msgImage} />
              ) : null}
              {m.body ? <Text style={[styles.msgText, m.is_me && styles.msgTextMe]}>{m.body}</Text> : null}
              <View style={styles.msgFooter}>
                <Text style={[styles.msgTime, m.is_me && { color: Colors.primaryForeground + 'aa' }]}>
                  {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </Text>
                {m.converted_to_task_id ? (
                  <View style={styles.taskBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={Colors.greenReady} />
                    <Text style={styles.taskBadgeText}>Task created</Text>
                  </View>
                ) : (
                  !m.is_me && (
                    <TouchableOpacity
                      testID={`convert-msg-${m.id}`}
                      style={styles.convertBtn}
                      onPress={() => openTaskModal(m)}
                    >
                      <Ionicons name="square-outline" size={13} color={Colors.textSecondary} />
                      <Text style={styles.convertBtnText}>Add to tasks</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.emptyMsg}>Say hi 👋</Text>}
        />

        {attachment && (
          <View style={styles.attachPreview}>
            <Image source={{ uri: `data:${attachment.mime};base64,${attachment.base64}` }} style={styles.attachPreviewImg} />
            <TouchableOpacity onPress={() => setAttachment(null)} style={styles.attachClear}>
              <Ionicons name="close-circle" size={22} color={Colors.redUrgent} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.attachBtn} onPress={takePhoto}>
            <Ionicons name="camera" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachBtn} onPress={attachPhoto}>
            <Ionicons name="image" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TextInput
            testID="msg-input"
            style={styles.input}
            value={newMsg}
            onChangeText={setNewMsg}
            placeholder="Type a message..."
            placeholderTextColor={Colors.grayInactive}
            multiline
          />
          <TouchableOpacity testID="send-msg-btn" style={[styles.sendBtn, (!newMsg.trim() && !attachment) && styles.sendBtnDisabled]} onPress={sendMessage} disabled={sending || (!newMsg.trim() && !attachment)}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>

        {/* Convert to Task Modal */}
        <Modal visible={!!taskModal} transparent animationType="slide" onRequestClose={() => setTaskModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHead}>
                <Ionicons name="checkbox" size={22} color={Colors.accent} />
                <Text style={styles.modalTitle}>Convert to Task</Text>
                <TouchableOpacity onPress={() => setTaskModal(null)}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
                {taskModal?.body ? (
                  <View style={styles.originalMsgBox}>
                    <Text style={styles.originalMsgLabel}>Original message</Text>
                    <Text style={styles.originalMsgText}>"{taskModal.body}"</Text>
                  </View>
                ) : null}

                <Text style={styles.fieldLabel}>Task Title *</Text>
                <TextInput testID="task-title" style={styles.textField} value={taskTitle} onChangeText={setTaskTitle} placeholder="What needs to be done?" placeholderTextColor={Colors.grayInactive} />

                <Text style={styles.fieldLabel}>Assign to *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {team.map(u => {
                    const active = taskAssignee === u.id;
                    return (
                      <TouchableOpacity key={u.id} testID={`assignee-${u.id}`} style={[styles.userChip, active && styles.userChipActive]} onPress={() => setTaskAssignee(u.id)}>
                        <View style={[styles.roleDot, { backgroundColor: ROLE_COLORS[u.role] || Colors.grayInactive }]} />
                        <Text style={[styles.userChipText, active && styles.userChipTextActive]}>{u.first_name} {u.last_name.slice(0,1)}.</Text>
                        <Text style={[styles.userChipRole, active && styles.userChipRoleActive]}>{u.role.replace(/_/g, ' ')}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={styles.fieldLabel}>Priority</Text>
                <View style={styles.pillRow}>
                  {PRIORITY_OPTIONS.map(p => (
                    <TouchableOpacity key={p.value} style={[styles.pill, { borderColor: p.color }, taskPriority === p.value && { backgroundColor: p.color }]} onPress={() => setTaskPriority(p.value)}>
                      <Text style={[styles.pillText, { color: taskPriority === p.value ? '#fff' : p.color }]}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Trade</Text>
                <View style={styles.pillRow}>
                  {TRADE_OPTIONS.map(t => (
                    <TouchableOpacity key={t.value} style={[styles.tradePill, taskTrade === t.value && styles.tradePillActive]} onPress={() => setTaskTrade(t.value)}>
                      <Ionicons name={t.icon as any} size={13} color={taskTrade === t.value ? '#fff' : Colors.textSecondary} />
                      <Text style={[styles.pillText, { color: taskTrade === t.value ? '#fff' : Colors.textSecondary }]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Property (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                  <TouchableOpacity style={[styles.propChip, !taskProperty && styles.propChipActive]} onPress={() => setTaskProperty('')}><Text style={[styles.propChipText, !taskProperty && styles.propChipTextActive]}>None</Text></TouchableOpacity>
                  {properties.map((p: any) => (
                    <TouchableOpacity key={p.id} style={[styles.propChip, taskProperty === p.id && styles.propChipActive]} onPress={() => setTaskProperty(p.id)}>
                      <Text style={[styles.propChipText, taskProperty === p.id && styles.propChipTextActive]}>{p.nickname || p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity testID="create-task-btn" style={styles.primaryBtn} onPress={convertToTask}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Create Task</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  // ==================== CONVERSATIONS LIST ====================
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Team Messages</Text>
        <Text style={styles.headerSub}>Chat with your cleaners, maintenance & trades</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: c }) => {
          const title = c.conversation_type === 'group' ? (c.name || c.participant_names.join(', ')) : c.participant_names[0] || 'Chat';
          const otherPart = c.participants?.find((p: any) => !p.is_me);
          const role = c.conversation_type === 'group' ? `${c.participants?.length} people` : otherPart?.role?.replace(/_/g, ' ') || '';
          return (
            <TouchableOpacity testID={`conv-${c.id}`} style={styles.convCard} onPress={() => openConversation(c)}>
              <View style={[styles.convAvatar, c.unread_count > 0 && styles.convAvatarUnread]}>
                <Ionicons name={c.conversation_type === 'group' ? 'people' : (ROLE_ICONS[otherPart?.role || ''] || 'person') as any} size={22} color={c.unread_count > 0 ? '#fff' : Colors.primary} />
              </View>
              <View style={styles.convInfo}>
                <View style={styles.convTitleRow}>
                  <Text style={[styles.convName, c.unread_count > 0 && { fontWeight: '800' }]} numberOfLines={1}>{title}</Text>
                  {c.last_message && <Text style={styles.convTime}>{new Date(c.last_message.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text>}
                </View>
                <View style={styles.convMetaRow}>
                  <Text style={styles.convType} numberOfLines={1}>{c.property_name ? `📍 ${c.property_name} · ` : ''}{role}</Text>
                  {c.unread_count > 0 && <View style={styles.unreadDot}><Text style={styles.unreadDotText}>{c.unread_count}</Text></View>}
                </View>
                {c.last_message && (
                  <Text style={[styles.convPreview, c.unread_count > 0 && { color: Colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
                    {c.last_message.message_type === 'photo' ? '📷 Photo' : c.last_message.message_type === 'voice' ? '🎤 Voice note' : c.last_message.body}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={56} color={Colors.grayInactive} />
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptyHint}>Tap + to start chatting with your team</Text>
          </View>
        }
      />

      <TouchableOpacity testID="new-message-fab" style={styles.fab} onPress={() => setShowNewConv(true)}>
        <Ionicons name="create" size={24} color="#fff" />
      </TouchableOpacity>

      {/* New Conversation Modal */}
      <Modal visible={showNewConv} transparent animationType="slide" onRequestClose={() => setShowNewConv(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <Ionicons name="chatbubbles" size={22} color={Colors.primary} />
              <Text style={styles.modalTitle}>New Conversation</Text>
              <TouchableOpacity onPress={() => setShowNewConv(false)}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
              <Text style={styles.fieldLabel}>Choose people ({pickedUserIds.length} selected)</Text>
              <Text style={styles.hintText}>Tap 1 for direct message · tap 2+ for group chat</Text>
              <View style={{ gap: 6, marginTop: 6 }}>
                {team.map(u => {
                  const active = pickedUserIds.includes(u.id);
                  const color = ROLE_COLORS[u.role] || Colors.grayInactive;
                  return (
                    <TouchableOpacity key={u.id} testID={`pick-user-${u.id}`} style={[styles.userRow, active && styles.userRowActive]} onPress={() => setPickedUserIds(active ? pickedUserIds.filter(id => id !== u.id) : [...pickedUserIds, u.id])}>
                      <View style={[styles.userIcon, { backgroundColor: color + '20' }]}>
                        <Ionicons name={(ROLE_ICONS[u.role] || 'person') as any} size={18} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{u.first_name} {u.last_name}</Text>
                        <Text style={styles.userRole}>{u.role.replace(/_/g, ' ')}</Text>
                      </View>
                      <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={active ? Colors.greenReady : Colors.grayInactive} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {pickedUserIds.length > 1 && (
                <>
                  <Text style={styles.fieldLabel}>Group Name (optional)</Text>
                  <TextInput style={styles.textField} value={groupName} onChangeText={setGroupName} placeholder="e.g. Sunset Cove Team" placeholderTextColor={Colors.grayInactive} />
                </>
              )}

              <Text style={styles.fieldLabel}>Tag Property (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                <TouchableOpacity style={[styles.propChip, !pickedProperty && styles.propChipActive]} onPress={() => setPickedProperty('')}><Text style={[styles.propChipText, !pickedProperty && styles.propChipTextActive]}>None</Text></TouchableOpacity>
                {properties.map((p: any) => (
                  <TouchableOpacity key={p.id} style={[styles.propChip, pickedProperty === p.id && styles.propChipActive]} onPress={() => setPickedProperty(p.id)}>
                    <Text style={[styles.propChipText, pickedProperty === p.id && styles.propChipTextActive]}>{p.nickname || p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity testID="create-conv-btn" style={[styles.primaryBtn, pickedUserIds.length === 0 && { opacity: 0.5 }]} disabled={pickedUserIds.length === 0} onPress={createConversation}>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Start Chat</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { padding: Spacing.md, gap: 2, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 12, color: Colors.textSecondary },

  list: { padding: Spacing.md, gap: Spacing.sm },
  convCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  convAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  convAvatarUnread: { backgroundColor: Colors.primary },
  convInfo: { flex: 1, gap: 2 },
  convTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  convName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  convTime: { fontSize: 11, color: Colors.textSecondary },
  convMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convType: { fontSize: 11, color: Colors.textSecondary, textTransform: 'capitalize', flex: 1 },
  convPreview: { fontSize: 13, color: Colors.textSecondary },
  unreadDot: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Colors.redUrgent, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  unreadDotText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  fab: { position: 'absolute', bottom: 24, right: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 },

  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  emptyText: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  emptyHint: { fontSize: 12, color: Colors.grayInactive },
  emptyMsg: { textAlign: 'center', fontSize: 14, color: Colors.grayInactive, paddingTop: 60 },

  // Thread view
  threadHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  threadHeaderAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  threadTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  threadSub: { fontSize: 11, color: Colors.textSecondary, textTransform: 'capitalize' },
  messagesList: { padding: Spacing.md, gap: 8, paddingBottom: 20 },
  msgBubble: { maxWidth: '85%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  msgMe: { backgroundColor: Colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  msgThem: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  msgSenderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  msgSender: { fontSize: 11, fontWeight: '700' },
  msgImage: { width: 220, height: 220, borderRadius: 8, marginVertical: 4, backgroundColor: Colors.surfaceSecondary },
  msgText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  msgTextMe: { color: Colors.primaryForeground },
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  msgTime: { fontSize: 10, color: Colors.grayInactive },
  convertBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  convertBtnText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  taskBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.greenReady + '20', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  taskBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.greenReady },

  attachPreview: { padding: Spacing.sm, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, flexDirection: 'row', alignItems: 'center' },
  attachPreviewImg: { width: 60, height: 60, borderRadius: 6 },
  attachClear: { marginLeft: 8 },

  inputRow: { flexDirection: 'row', padding: Spacing.sm, gap: 6, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'flex-end' },
  attachBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  input: { flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '92%' },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: Colors.textPrimary },

  fieldLabel: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: 6 },
  hintText: { fontSize: 11, color: Colors.grayInactive },
  textField: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  originalMsgBox: { backgroundColor: Colors.accent + '10', borderRadius: 10, padding: 10, borderLeftWidth: 3, borderLeftColor: Colors.accent, marginBottom: 4 },
  originalMsgLabel: { fontSize: 10, fontWeight: '800', color: Colors.accent, letterSpacing: 0.5, marginBottom: 2 },
  originalMsgText: { fontSize: 13, color: Colors.textPrimary, fontStyle: 'italic' },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: Colors.surfaceSecondary, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  userRowActive: { backgroundColor: Colors.primary + '10', borderColor: Colors.primary },
  userIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  userName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  userRole: { fontSize: 11, color: Colors.textSecondary, textTransform: 'capitalize' },
  userChip: { flexDirection: 'column', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border, minWidth: 90 },
  userChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  userChipText: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  userChipTextActive: { color: '#fff' },
  userChipRole: { fontSize: 9, color: Colors.textSecondary, textTransform: 'capitalize' },
  userChipRoleActive: { color: '#fff' + 'cc' },
  roleDot: { width: 6, height: 6, borderRadius: 3, position: 'absolute', top: 4, right: 4 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5 },
  pillText: { fontSize: 12, fontWeight: '700' },
  tradePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  tradePillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  propChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  propChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  propChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  propChipTextActive: { color: '#fff' },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 10, marginTop: Spacing.md },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
