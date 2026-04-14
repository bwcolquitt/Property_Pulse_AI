import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/messages/conversations');
        setConversations(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const openConversation = async (convId: string) => {
    setSelectedConv(convId);
    try {
      const { data } = await api.get(`/messages/conversations/${convId}`);
      setMessages(data);
    } catch (e) { console.error(e); }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedConv) return;
    try {
      await api.post(`/messages/conversations/${selectedConv}`, { body: newMsg });
      setNewMsg('');
      openConversation(selectedConv);
    } catch (e) { console.error(e); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  if (selectedConv) {
    return (
      <View style={styles.container}>
        <TouchableOpacity testID="back-to-conversations" style={styles.backRow} onPress={() => setSelectedConv(null)}>
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
          <Text style={styles.backText}>Conversations</Text>
        </TouchableOpacity>
        <FlatList
          data={messages}
          keyExtractor={(m, i) => m.id || String(i)}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item: m }) => (
            <View style={[styles.msgBubble, m.is_me ? styles.msgMe : styles.msgThem]}>
              {!m.is_me && <Text style={styles.msgSender}>{m.sender_name}</Text>}
              <Text style={[styles.msgText, m.is_me && styles.msgTextMe]}>{m.body}</Text>
              <Text style={styles.msgTime}>{new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text>
            </View>
          )}
        />
        <View style={styles.inputRow}>
          <TextInput testID="message-input" style={styles.input} value={newMsg} onChangeText={setNewMsg} placeholder="Type a message..." placeholderTextColor={Colors.grayInactive} />
          <TouchableOpacity testID="send-msg-btn" style={styles.sendBtn} onPress={sendMessage}>
            <Ionicons name="send" size={18} color={Colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: c }) => (
          <TouchableOpacity testID={`conv-${c.id}`} style={styles.convCard} onPress={() => openConversation(c.id)}>
            <View style={styles.convAvatar}><Ionicons name="chatbubble" size={20} color={Colors.primary} /></View>
            <View style={styles.convInfo}>
              <Text style={styles.convName}>{c.participant_names?.join(', ') || 'Conversation'}</Text>
              <Text style={styles.convType}>{c.conversation_type}</Text>
              {c.last_message && <Text style={styles.convPreview} numberOfLines={1}>{c.last_message.body}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.grayInactive} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="chatbubbles-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No conversations yet</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm },
  convCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  convAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  convInfo: { flex: 1, gap: 2 },
  convName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  convType: { fontSize: 12, color: Colors.textSecondary, textTransform: 'capitalize' },
  convPreview: { fontSize: 13, color: Colors.textSecondary },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  messagesList: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 10 },
  msgBubble: { maxWidth: '80%', padding: Spacing.sm, borderRadius: 12 },
  msgMe: { backgroundColor: Colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  msgThem: { backgroundColor: Colors.surfaceSecondary, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  msgSender: { fontSize: 11, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
  msgText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  msgTextMe: { color: Colors.primaryForeground },
  msgTime: { fontSize: 10, color: Colors.grayInactive, marginTop: 4, alignSelf: 'flex-end' },
  inputRow: { flexDirection: 'row', padding: Spacing.sm, gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  input: { flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
});
