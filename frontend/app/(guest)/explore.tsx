import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/constants/theme';
import api from '../../src/utils/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Msg { id: string; role: 'user' | 'assistant'; content: string; }

const EXPLORE_QUESTIONS = [
  'Best restaurants near me',
  'Where is the nearest grocery store?',
  'What beaches are nearby?',
  'Fun activities for kids',
  'Best coffee shops around here',
  'Where can I rent bikes or surfboards?',
];

export default function GuestExploreScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [stay, setStay] = useState<any>(null);
  const [sessionId] = useState(() => `explore-${Date.now()}`);
  const listRef = useRef<FlatList>(null);

  useEffect(() => { api.get('/guest-portal/my-stay').then(r => setStay(r.data)).catch(() => {}); }, []);

  const locationContext = () => {
    if (!stay?.property) return '';
    const p = stay.property;
    const parts = [p.address, p.city, p.state, p.zip].filter(Boolean).join(', ');
    return parts ? `The guest is staying at "${p.name}" located at ${parts}. Recommend places specifically in or near this area.` : '';
  };

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || sending) return;
    Keyboard.dismiss(); setInput('');
    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    try {
      const context = locationContext();
      const prompt = context ? `${context}\n\nGuest question: ${msg}` : `I'm a guest staying at a rental property. ${msg}`;
      const { data } = await api.post('/ai-chat/send', { message: prompt, session_id: sessionId, user_role: 'guest' });
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: data.response }]);
    } catch {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: "Sorry, I had trouble. Please try again!" }]);
    }
    finally { setSending(false); }
  };

  useEffect(() => { if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100); }, [messages]);

  const formatLine = (line: string, i: number) => {
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)/)?.[1] || '';
      const rest = line.replace(/^\d+\.\s*/, '');
      return <View key={i} style={styles.numRow}><View style={styles.numBadge}><Text style={styles.numText}>{num}</Text></View><Text style={styles.msgText}>{rest}</Text></View>;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) return <View key={i} style={styles.bulletRow}><View style={styles.bullet} /><Text style={styles.msgText}>{line.slice(2)}</Text></View>;
    if (line.trim() === '') return <View key={i} style={{ height: 4 }} />;
    return <Text key={i} style={styles.msgText}>{line}</Text>;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container} keyboardVerticalOffset={90}>
      {stay?.property?.city && (
        <View style={styles.locBar}>
          <Ionicons name="location" size={14} color={Colors.secondary} />
          <Text style={styles.locText}>Showing recommendations near {stay.property.city}{stay.property.state ? `, ${stay.property.state}` : ''}</Text>
        </View>
      )}
      <FlatList ref={listRef} data={messages} keyExtractor={m => m.id} contentContainerStyle={[styles.list, messages.length === 0 && { flexGrow: 1, justifyContent: 'center' }]}
        renderItem={({ item }) => (
          <View style={[styles.msgRow, item.role === 'user' ? styles.userRow : styles.aiRow]}>
            {item.role === 'assistant' && <View style={styles.aiAvatar}><Ionicons name="compass" size={16} color={Colors.secondary} /></View>}
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {item.role === 'assistant' ? item.content.split('\n').map(formatLine) : <Text style={styles.userText}>{item.content}</Text>}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="compass" size={48} color={Colors.secondary} />
            <Text style={styles.emptyTitle}>AI Local Concierge</Text>
            <Text style={styles.emptySub}>
              {stay?.property?.city
                ? `Ask me about restaurants, activities, and places near ${stay.property.city}!`
                : 'Ask me about restaurants, attractions, grocery stores, activities, and anything nearby!'}
            </Text>
            <View style={styles.quickGrid}>
              {EXPLORE_QUESTIONS.map((q, i) => (
                <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => send(q)}>
                  <Ionicons name="location" size={14} color={Colors.secondary} />
                  <Text style={styles.quickText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
      />
      {sending && <View style={styles.typingRow}><View style={styles.aiAvatar}><Ionicons name="compass" size={12} color={Colors.secondary} /></View><View style={styles.typingBubble}><ActivityIndicator size="small" color={Colors.primary} /><Text style={styles.typingText}>Finding...</Text></View></View>}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput style={styles.inputField} value={input} onChangeText={setInput} placeholder="Where should I eat tonight?" placeholderTextColor={Colors.grayInactive} onSubmitEditing={() => send()} />
        <TouchableOpacity style={[styles.sendBtn, (!input.trim() || sending) && styles.sendDisabled]} onPress={() => send()} disabled={!input.trim() || sending}>
          <Ionicons name="send" size={20} color={!input.trim() || sending ? Colors.grayInactive : '#fff'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  locBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 8, backgroundColor: Colors.secondary + '10', borderBottomWidth: 1, borderBottomColor: Colors.secondary + '20' },
  locText: { fontSize: 12, fontWeight: '600', color: Colors.secondary, flex: 1 },
  list: { padding: Spacing.md, gap: Spacing.sm },
  msgRow: { flexDirection: 'row', gap: 8, maxWidth: '90%' },
  userRow: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  aiRow: { alignSelf: 'flex-start' },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.secondary + '15', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  bubble: { borderRadius: 16, padding: Spacing.sm, maxWidth: '85%', gap: 2 },
  userBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  userText: { fontSize: 15, color: '#fff', lineHeight: 20 },
  msgText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  numRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 2 },
  numBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.secondary + '15', justifyContent: 'center', alignItems: 'center' },
  numText: { fontSize: 10, fontWeight: '800', color: Colors.secondary },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 1 },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.secondary, marginTop: 7 },
  typingRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.md, paddingBottom: 4, alignItems: 'center' },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  typingText: { fontSize: 13, color: Colors.textSecondary },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: Spacing.md, paddingTop: 8, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  inputField: { flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center' },
  sendDisabled: { backgroundColor: Colors.surfaceSecondary },
  emptyState: { alignItems: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  quickGrid: { gap: 6, width: '100%', marginTop: Spacing.sm },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  quickText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
});
