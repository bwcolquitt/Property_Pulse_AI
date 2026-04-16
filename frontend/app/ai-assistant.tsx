import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import api from '../src/utils/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

const QUICK_QUESTIONS = [
  'How do I create a turnover?',
  'How do I complete a checklist?',
  'How do I report a maintenance issue?',
  'How do I set up auto-payments?',
  'How do I scan a QR code?',
  'How do I book a property?',
];

export default function AIAssistantScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || sending) return;
    Keyboard.dismiss();
    setInput('');

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    try {
      const { data } = await api.post('/ai-chat/send', {
        message: msg,
        session_id: sessionId,
        user_role: user?.role || 'guest',
      });
      const aiMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', content: data.response };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      const errMsg: Message = { id: `e-${Date.now()}`, role: 'assistant', content: 'Sorry, I had trouble answering. Please try again!' };
      setMessages(prev => [...prev, errMsg]);
    }
    finally { setSending(false); }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const formatContent = (content: string) => {
    // Simple markdown-like formatting
    return content.split('\n').map((line, i) => {
      const isBold = line.startsWith('**') && line.endsWith('**');
      const isHeader = line.startsWith('##');
      const isNumbered = /^\d+\.\s/.test(line);
      const isBullet = line.startsWith('- ') || line.startsWith('* ');

      if (isHeader) {
        return <Text key={i} style={styles.msgHeader}>{line.replace(/^#+\s*/, '')}</Text>;
      }
      if (isNumbered) {
        const num = line.match(/^(\d+)/)?.[1] || '';
        const rest = line.replace(/^\d+\.\s*/, '');
        return (
          <View key={i} style={styles.numberedRow}>
            <View style={styles.numBadge}><Text style={styles.numText}>{num}</Text></View>
            <Text style={styles.msgText}>{formatInline(rest)}</Text>
          </View>
        );
      }
      if (isBullet) {
        return (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={styles.msgText}>{formatInline(line.slice(2))}</Text>
          </View>
        );
      }
      if (line.trim() === '') return <View key={i} style={{ height: 6 }} />;
      return <Text key={i} style={styles.msgText}>{formatInline(line)}</Text>;
    });
  };

  const formatInline = (text: string) => {
    // Handle **bold** inline
    const parts = text.split(/\*\*(.*?)\*\*/);
    return parts.map((part, i) =>
      i % 2 === 1 ? <Text key={i} style={{ fontWeight: '700' }}>{part}</Text> : part
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container} keyboardVerticalOffset={90}>
      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={[styles.messageList, messages.length === 0 && { flexGrow: 1, justifyContent: 'center' }]}
        renderItem={({ item }) => (
          <View style={[styles.msgRow, item.role === 'user' ? styles.userRow : styles.aiRow]}>
            {item.role === 'assistant' && (
              <View style={styles.aiAvatar}><Ionicons name="sparkles" size={16} color={Colors.accent} /></View>
            )}
            <View style={[styles.msgBubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {item.role === 'assistant' ? formatContent(item.content) : <Text style={styles.userText}>{item.content}</Text>}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Ionicons name="chatbubble-ellipses" size={40} color={Colors.primary} /></View>
            <Text style={styles.emptyTitle}>Property Pulse AI Assistant</Text>
            <Text style={styles.emptySub}>Ask me anything about the app, your properties, or how to do something. I speak at a simple level!</Text>

            <Text style={styles.quickLabel}>Quick Questions</Text>
            <View style={styles.quickGrid}>
              {QUICK_QUESTIONS.map((q, i) => (
                <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => sendMessage(q)}>
                  <Ionicons name="help-circle" size={14} color={Colors.primary} />
                  <Text style={styles.quickText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
      />

      {/* Typing indicator */}
      {sending && (
        <View style={styles.typingRow}>
          <View style={styles.aiAvatar}><Ionicons name="sparkles" size={14} color={Colors.accent} /></View>
          <View style={styles.typingBubble}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask me anything..."
          placeholderTextColor={Colors.grayInactive}
          multiline
          maxLength={500}
          onSubmitEditing={() => sendMessage()}
        />
        <TouchableOpacity style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]} onPress={() => sendMessage()} disabled={!input.trim() || sending}>
          <Ionicons name="send" size={20} color={!input.trim() || sending ? Colors.grayInactive : '#fff'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  messageList: { padding: Spacing.md, gap: Spacing.sm },
  msgRow: { flexDirection: 'row', gap: 8, maxWidth: '90%' },
  userRow: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  aiRow: { alignSelf: 'flex-start' },
  aiAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.accent + '15', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  msgBubble: { borderRadius: 16, padding: Spacing.sm, maxWidth: '85%', gap: 2 },
  userBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  userText: { fontSize: 15, color: '#fff', lineHeight: 20 },
  msgText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  msgHeader: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  numberedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 2 },
  numBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  numText: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 1 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 7 },
  typingRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.md, paddingBottom: 4, alignItems: 'center' },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  typingText: { fontSize: 13, color: Colors.textSecondary },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: Spacing.md, paddingTop: 8, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.surfaceSecondary },
  // Empty state
  emptyState: { alignItems: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  quickLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginTop: Spacing.md },
  quickGrid: { gap: 6, width: '100%' },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  quickText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
});
