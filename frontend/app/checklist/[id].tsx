import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, ActivityIndicator, Alert, Platform, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/constants/theme';
import api from '../../src/utils/api';
import * as ImagePicker from 'expo-image-picker';

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [checklist, setChecklist] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [photosTaken, setPhotosTaken] = useState<Record<string, number>>({});
  const [hideCompleted, setHideCompleted] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'cleaning' | 'maintenance'>('all');

  const fetchChecklist = useCallback(async () => {
    try {
      const { data } = await api.get(`/turnovers/${id}/checklist`);
      setChecklist(data.checklist);
      setItems(data.items);
      setProperty(data.property);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchChecklist(); }, [fetchChecklist]);

  const toggleItem = async (item: any) => {
    // If requires photo and no photo taken, block completion
    if (item.status !== 'completed' && item.requires_photo && !(photosTaken[item.id] > 0)) {
      Alert.alert('Photo Required', 'Please take a photo before marking this task complete. Use the camera or gallery button.', [{ text: 'OK' }]);
      return;
    }
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    try {
      await api.put(`/turnovers/checklist-items/${item.id}`, { status: newStatus });
      fetchChecklist();
    } catch (e) { console.error(e); }
  };

  const takePhoto = async (item: any) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        pickPhoto(item);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
      if (!result.canceled && result.assets[0]?.base64) uploadPhoto(item, result.assets[0].base64);
    } catch { pickPhoto(item); }
  };

  const pickPhoto = async (item: any) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access is required.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
      if (!result.canceled && result.assets[0]?.base64) uploadPhoto(item, result.assets[0].base64);
    } catch (e) { console.error(e); }
  };

  const uploadPhoto = async (item: any, base64Data: string) => {
    setUploading(item.id);
    try {
      await api.post('/media/upload', { owner_type: 'checklist_item', owner_id: item.id, media_type: 'photo', base64_data: base64Data });
      setPhotosTaken(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
    } catch (e) { console.error(e); }
    finally { setUploading(null); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  // Filter items
  let filteredItems = items;
  if (typeFilter !== 'all') {
    filteredItems = filteredItems.filter(i => i.checklist_type === typeFilter || i.checklist_type === 'both');
  }
  if (hideCompleted) {
    filteredItems = filteredItems.filter(i => i.status !== 'completed');
  }

  // Group by floor, then by room within floor
  const floors: Record<string, any[]> = {};
  filteredItems.forEach(item => {
    const floor = item.floor || 'General';
    if (!floors[floor]) floors[floor] = [];
    floors[floor].push(item);
  });

  // Preserve floor order from property config
  const floorOrder = property?.floors || Object.keys(floors);
  const sections = floorOrder
    .filter((f: string) => floors[f] && floors[f].length > 0)
    .map((floor: string) => {
      const floorItems = floors[floor] || [];
      const completed = floorItems.filter((i: any) => i.status === 'completed').length;
      return { title: floor, data: floorItems, completed, total: floorItems.length };
    });

  // Add any floors not in the config
  Object.keys(floors).forEach(f => {
    if (!floorOrder.includes(f) && floors[f].length > 0) {
      const floorItems = floors[f];
      sections.push({ title: f, data: floorItems, completed: floorItems.filter((i: any) => i.status === 'completed').length, total: floorItems.length });
    }
  });

  const totalItems = items.length;
  const completedItems = items.filter(i => i.status === 'completed').length;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const allDone = completedItems === totalItems && totalItems > 0;

  const roomIcon = (room: string) => {
    const r = room.toLowerCase();
    if (r.includes('kitchen')) return 'restaurant';
    if (r.includes('bath') || r.includes('powder')) return 'water';
    if (r.includes('bed') || r.includes('suite') || r.includes('studio')) return 'bed';
    if (r.includes('living') || r.includes('dining')) return 'tv';
    if (r.includes('patio') || r.includes('deck') || r.includes('yard') || r.includes('pool') || r.includes('outdoor')) return 'leaf';
    if (r.includes('entry') || r.includes('foyer') || r.includes('lobby')) return 'enter';
    if (r.includes('laundry')) return 'shirt';
    if (r.includes('parking') || r.includes('garage') || r.includes('driveway')) return 'car';
    if (r.includes('final') || r.includes('walkthrough')) return 'checkmark-done';
    return 'cube';
  };

  return (
    <View style={styles.container}>
      {/* Property Header */}
      {property && (
        <View style={styles.propertyHeader}>
          <Text style={styles.propertyNickname}>{property.nickname || property.name}</Text>
          <Text style={styles.propertyAddress}>{property.address_1}, {property.city}, {property.state}</Text>
        </View>
      )}

      {/* Progress Bar */}
      <View style={styles.progressHeader}>
        <View style={styles.progressRow}>
          <Text style={styles.progressTitle}>{completedItems} of {totalItems} complete</Text>
          <Text style={[styles.progressPercent, { color: allDone ? Colors.greenReady : Colors.primary }]}>{progress}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: allDone ? Colors.greenReady : Colors.primary }]} />
        </View>
      </View>

      {/* Controls: Type Filter + Hide Completed Toggle */}
      <View style={styles.controls}>
        <View style={styles.typeFilters}>
          {(['all', 'cleaning', 'maintenance'] as const).map(t => (
            <TouchableOpacity key={t} testID={`type-filter-${t}`} style={[styles.typeBtn, typeFilter === t && styles.typeBtnActive]} onPress={() => setTypeFilter(t)}>
              <Ionicons name={t === 'all' ? 'list' : t === 'cleaning' ? 'sparkles' : 'construct'} size={14} color={typeFilter === t ? Colors.primaryForeground : Colors.textSecondary} />
              <Text style={[styles.typeBtnText, typeFilter === t && styles.typeBtnTextActive]}>{t === 'all' ? 'All' : t === 'cleaning' ? 'Cleaning' : 'Maint.'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Hide done</Text>
          <Switch testID="hide-completed-toggle" value={hideCompleted} onValueChange={setHideCompleted} trackColor={{ true: Colors.primary, false: Colors.border }} thumbColor={Colors.surface} />
        </View>
      </View>

      {/* Submit Button */}
      {allDone && (
        <TouchableOpacity testID="submit-checklist-btn" style={styles.submitBtn} onPress={() => {
          Alert.alert('Checklist Complete!', 'All tasks done. Mark turnover as ready for inspection?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Submit', onPress: () => router.back() },
          ]);
        }}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.submitBtnText}>Submit as Ready — {progress}%</Text>
        </TouchableOpacity>
      )}

      {/* Checklist by Floor */}
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={styles.floorHeader}>
            <Ionicons name={section.title.toLowerCase().includes('exterior') || section.title.toLowerCase().includes('rooftop') ? 'sunny' : 'layers'} size={18} color={Colors.accent} />
            <Text style={styles.floorTitle}>{section.title}</Text>
            <View style={styles.floorBadge}>
              <Text style={styles.floorCount}>{section.completed}/{section.total}</Text>
            </View>
          </View>
        )}
        renderItem={({ item: task }) => {
          const hasPhoto = (photosTaken[task.id] || 0) > 0;
          const needsPhoto = task.requires_photo && !hasPhoto;
          const typeColor = task.checklist_type === 'cleaning' ? Colors.secondary : task.checklist_type === 'maintenance' ? Colors.accent : Colors.primary;

          return (
            <View style={styles.taskCard}>
              <TouchableOpacity testID={`task-${task.id}`} style={styles.taskMain} onPress={() => toggleItem(task)}>
                <View style={[styles.checkbox, task.status === 'completed' && styles.checkboxDone]}>
                  {task.status === 'completed' && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <View style={styles.taskInfo}>
                  <View style={styles.taskTitleRow}>
                    <Ionicons name={roomIcon(task.room_name) as any} size={14} color={Colors.textSecondary} />
                    <Text style={styles.taskRoom}>{task.room_name}</Text>
                    <View style={[styles.typePill, { backgroundColor: typeColor + '15' }]}>
                      <Text style={[styles.typePillText, { color: typeColor }]}>
                        {task.checklist_type === 'both' ? 'Both' : task.checklist_type === 'cleaning' ? 'Clean' : 'Maint.'}
                      </Text>
                    </View>
                    {!task.is_inside && (
                      <View style={styles.outsidePill}><Text style={styles.outsideText}>Outside</Text></View>
                    )}
                  </View>
                  <Text style={[styles.taskTitle, task.status === 'completed' && styles.taskDone]}>{task.title}</Text>
                  {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}
                  {/* Photo requirement indicator */}
                  {task.requires_photo && (
                    <View style={[styles.photoReq, hasPhoto && styles.photoReqDone]}>
                      <Ionicons name={hasPhoto ? 'checkmark-circle' : 'camera'} size={13} color={hasPhoto ? Colors.greenReady : Colors.redUrgent} />
                      <Text style={[styles.photoReqText, { color: hasPhoto ? Colors.greenReady : Colors.redUrgent }]}>
                        {hasPhoto ? `${photosTaken[task.id]} photo(s) taken` : 'Photo required'}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              {/* Photo buttons */}
              <View style={styles.photoActions}>
                <TouchableOpacity testID={`photo-camera-${task.id}`} style={[styles.photoBtn, needsPhoto && styles.photoBtnUrgent]} onPress={() => takePhoto(task)}>
                  {uploading === task.id ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="camera" size={18} color={needsPhoto ? Colors.redUrgent : Colors.primary} />}
                </TouchableOpacity>
                <TouchableOpacity testID={`photo-gallery-${task.id}`} style={styles.photoBtn} onPress={() => pickPhoto(task)}>
                  <Ionicons name="images" size={18} color={Colors.secondary} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.greenReady} />
            <Text style={styles.emptyTitle}>{hideCompleted ? 'All visible tasks complete!' : 'No tasks found'}</Text>
            {hideCompleted && <Text style={styles.emptyText}>Turn off "Hide done" to see all tasks</Text>}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  // Property Header
  propertyHeader: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  propertyNickname: { fontSize: 20, fontWeight: '800', color: Colors.primaryForeground },
  propertyAddress: { fontSize: 13, color: Colors.primaryForeground + 'CC', marginTop: 2 },
  // Progress
  progressHeader: { backgroundColor: Colors.surface, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  progressPercent: { fontSize: 16, fontWeight: '800' },
  progressBar: { height: 10, backgroundColor: Colors.surfaceSecondary, borderRadius: 5 },
  progressFill: { height: 10, borderRadius: 5 },
  // Controls
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  typeFilters: { flexDirection: 'row', gap: 6 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  typeBtnTextActive: { color: Colors.primaryForeground },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  // Submit
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.greenReady, marginHorizontal: Spacing.md, marginTop: Spacing.sm, paddingVertical: 14, borderRadius: 10 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  // List
  list: { paddingBottom: 40 },
  // Floor Header
  floorHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: Colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: Colors.border },
  floorTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  floorBadge: { backgroundColor: Colors.primary + '15', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  floorCount: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  // Task Card
  taskCard: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  taskMain: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 4 },
  checkbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkboxDone: { backgroundColor: Colors.greenReady, borderColor: Colors.greenReady },
  taskInfo: { flex: 1, gap: 2 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  taskRoom: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  typePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  typePillText: { fontSize: 9, fontWeight: '700' },
  outsidePill: { backgroundColor: Colors.accent + '15', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  outsideText: { fontSize: 9, fontWeight: '700', color: Colors.accent },
  taskTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  taskDone: { textDecorationLine: 'line-through', color: Colors.grayInactive },
  taskDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  photoReq: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  photoReqDone: {},
  photoReqText: { fontSize: 11, fontWeight: '600' },
  // Photo actions
  photoActions: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, marginLeft: 40 },
  photoBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  photoBtnUrgent: { borderColor: Colors.redUrgent + '50', backgroundColor: Colors.redUrgent + '08' },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
});
