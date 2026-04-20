import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';
import * as ImagePicker from 'expo-image-picker';

const PRIO_COLORS: Record<string, string> = { nice_to_have: Colors.blueAssigned, recommended: Colors.yellowAtRisk, high_impact: Colors.accent };
const STATUS_COLORS: Record<string, string> = { suggested: Colors.blueAssigned, approved: Colors.greenReady, dismissed: Colors.grayInactive, completed: Colors.greenReady };

export default function ImprovementsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState({ property_id: '', title: '', description: '', location: '', priority: 'nice_to_have' });
  const [photo, setPhoto] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [iRes, pRes] = await Promise.all([api.get('/improvements'), api.get('/properties')]);
      setItems(iRes.data);
      setProperties(pRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const submit = async () => {
    if (!form.property_id || !form.title) { Alert.alert('Required', 'Select property and enter title'); return; }
    try {
      await api.post('/improvements', { ...form, photo_base64: photo });
      Alert.alert('Submitted', 'Improvement suggestion recorded');
      setCreateModal(false); setForm({ property_id: '', title: '', description: '', location: '', priority: 'nice_to_have' }); setPhoto('');
      fetchData();
    } catch { Alert.alert('Error', 'Failed'); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <FlatList data={items} keyExtractor={i => i.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Colors.primary} />}
        ListHeaderComponent={<View style={styles.headerInfo}><Ionicons name="bulb" size={22} color={Colors.accent} /><Text style={styles.headerTitle}>Improvement Opportunities</Text><Text style={styles.headerSub}>Log suggestions for property upgrades that aren't issues but could improve guest experience</Text></View>}
        renderItem={({ item }) => {
          const prioColor = PRIO_COLORS[item.priority] || Colors.grayInactive;
          const statColor = STATUS_COLORS[item.status] || Colors.grayInactive;
          return (
            <View style={styles.card}>
              <View style={[styles.cardStripe, { backgroundColor: prioColor }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Ionicons name="bulb" size={16} color={Colors.accent} />
                  <View style={[styles.badge, { backgroundColor: prioColor + '15' }]}><Text style={[styles.badgeText, { color: prioColor }]}>{item.priority?.replace(/_/g, ' ')}</Text></View>
                  <View style={[styles.badge, { backgroundColor: statColor + '15' }]}><Text style={[styles.badgeText, { color: statColor }]}>{item.status}</Text></View>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardProp}>{item.property_name}{item.location ? ` · ${item.location}` : ''}</Text>
                {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
                {item.has_photo && <View style={styles.photoBadge}><Ionicons name="camera" size={12} color={Colors.blueAssigned} /><Text style={styles.photoText}>Photo attached</Text></View>}
                {item.status === 'suggested' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => api.put(`/improvements/${item.id}`, { action: 'approve' }).then(fetchData)}><Text style={styles.appText}>Approve</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.dismissBtn} onPress={() => api.put(`/improvements/${item.id}`, { action: 'dismiss' }).then(fetchData)}><Text style={styles.disText}>Dismiss</Text></TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="bulb-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No improvement suggestions yet</Text></View>}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setCreateModal(true)}><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity>

      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}><ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.modal}>
          <Text style={styles.modalTitle}>Suggest Improvement</Text>
          <Text style={styles.modalHint}>Not an issue — just something that could be better</Text>
          <Text style={styles.label}>Property *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.chipRow}>{properties.map(p => (<TouchableOpacity key={p.id} style={[styles.chip, form.property_id === p.id && styles.chipActive]} onPress={() => setForm({...form, property_id: p.id})}><Text style={[styles.chipText, form.property_id === p.id && { color: '#fff' }]}>{p.nickname || p.name}</Text></TouchableOpacity>))}</View></ScrollView>
          <Text style={styles.label}>What could be improved? *</Text>
          <TextInput style={styles.input} value={form.title} onChangeText={v => setForm({...form, title: v})} placeholder="TV wire could use a wire track" placeholderTextColor={Colors.grayInactive} />
          <Text style={styles.label}>Details</Text>
          <TextInput style={[styles.input, { height: 70 }]} value={form.description} onChangeText={v => setForm({...form, description: v})} placeholder="The power cable hangs loosely..." multiline placeholderTextColor={Colors.grayInactive} />
          <Text style={styles.label}>Location</Text>
          <TextInput style={styles.input} value={form.location} onChangeText={v => setForm({...form, location: v})} placeholder="Living room" placeholderTextColor={Colors.grayInactive} />
          <Text style={styles.label}>Impact</Text>
          <View style={styles.chipRow}>{['nice_to_have', 'recommended', 'high_impact'].map(p => (<TouchableOpacity key={p} style={[styles.chip, form.priority === p && { backgroundColor: PRIO_COLORS[p], borderColor: PRIO_COLORS[p] }]} onPress={() => setForm({...form, priority: p})}><Text style={[styles.chipText, form.priority === p && { color: '#fff' }]}>{p.replace(/_/g, ' ')}</Text></TouchableOpacity>))}</View>
          <TouchableOpacity style={styles.photoBtn} onPress={async () => { const r = await ImagePicker.launchCameraAsync({ quality: 0.6 }); if (!r.canceled) setPhoto(r.assets[0].uri); }}>
            <Ionicons name={photo ? 'checkmark-circle' : 'camera'} size={18} color={photo ? Colors.greenReady : Colors.primary} />
            <Text style={[styles.photoBtnText, photo && { color: Colors.greenReady }]}>{photo ? 'Photo Taken' : 'Take Photo'}</Text>
          </TouchableOpacity>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={submit}><Ionicons name="bulb" size={18} color="#fff" /><Text style={styles.saveText}>Submit</Text></TouchableOpacity>
          </View>
        </View></ScrollView></View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  headerInfo: { gap: 4, marginBottom: Spacing.sm },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  card: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  cardStripe: { width: 4 },
  cardBody: { flex: 1, padding: Spacing.md, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardProp: { fontSize: 12, color: Colors.textSecondary },
  cardDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  photoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  photoText: { fontSize: 11, fontWeight: '600', color: Colors.blueAssigned },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  approveBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.greenReady },
  appText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  dismissBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: Colors.grayInactive },
  disText: { fontSize: 13, fontWeight: '700', color: Colors.grayInactive },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '95%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalHint: { fontSize: 12, color: Colors.accent, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginTop: 4 },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed' },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: Colors.accent },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
