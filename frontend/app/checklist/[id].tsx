import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Image, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/constants/theme';
import api from '../../src/utils/api';
import * as ImagePicker from 'expo-image-picker';

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams(); // turnover id
  const router = useRouter();
  const [checklist, setChecklist] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, string[]>>({});

  const fetchChecklist = async () => {
    try {
      const { data } = await api.get(`/turnovers/${id}/checklist`);
      setChecklist(data.checklist);
      setItems(data.items);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchChecklist(); }, [id]);

  const toggleItem = async (item: any) => {
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
        if (Platform.OS === 'web') {
          // On web, fallback to photo library
          pickPhoto(item);
          return;
        }
        Alert.alert('Permission needed', 'Camera access is required to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        uploadPhoto(item, result.assets[0].base64);
      }
    } catch (e) {
      // Fallback to photo library on web
      pickPhoto(item);
    }
  };

  const pickPhoto = async (item: any) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        uploadPhoto(item, result.assets[0].base64);
      }
    } catch (e) { console.error(e); }
  };

  const uploadPhoto = async (item: any, base64Data: string) => {
    setUploading(item.id);
    try {
      await api.post('/media/upload', {
        owner_type: 'checklist_item',
        owner_id: item.id,
        media_type: 'photo',
        base64_data: base64Data,
      });
      setPhotos(prev => ({
        ...prev,
        [item.id]: [...(prev[item.id] || []), `data:image/jpeg;base64,${base64Data.substring(0, 100)}`],
      }));
      // Auto-complete item after photo
      if (item.status !== 'completed') {
        await api.put(`/turnovers/checklist-items/${item.id}`, { status: 'completed' });
        fetchChecklist();
      }
    } catch (e) { console.error(e); }
    finally { setUploading(null); }
  };

  // Group items by room
  const rooms = items.reduce((acc: any, item: any) => {
    const room = item.room_name || 'General';
    if (!acc[room]) acc[room] = [];
    acc[room].push(item);
    return acc;
  }, {});

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const completedCount = items.filter(i => i.status === 'completed').length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Progress Header */}
      <View style={styles.progressHeader}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressTitle}>{completedCount} of {totalCount} tasks</Text>
          <Text style={[styles.progressPercent, { color: progress === 100 ? Colors.greenReady : Colors.primary }]}>{progress}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        {progress === 100 && (
          <TouchableOpacity testID="submit-checklist-btn" style={styles.submitBtn} onPress={() => {
            Alert.alert('Checklist Complete', 'All tasks done! Marking turnover as ready for inspection.');
            router.back();
          }}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.submitBtnText}>Submit as Ready</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={Object.entries(rooms)}
        keyExtractor={([room]) => room}
        contentContainerStyle={styles.list}
        renderItem={({ item: [room, roomItems] }) => (
          <View style={styles.roomSection}>
            <View style={styles.roomHeader}>
              <Ionicons name={room === 'Kitchen' ? 'restaurant' : room === 'Bathroom' ? 'water' : room === 'Bedroom' ? 'bed' : room === 'Living Room' ? 'tv' : room === 'Outdoor' ? 'leaf' : 'checkbox'} size={18} color={Colors.primary} />
              <Text style={styles.roomTitle}>{room}</Text>
              <Text style={styles.roomCount}>{(roomItems as any[]).filter((i: any) => i.status === 'completed').length}/{(roomItems as any[]).length}</Text>
            </View>
            {(roomItems as any[]).map((task: any) => (
              <View key={task.id} style={styles.taskRow}>
                <TouchableOpacity testID={`task-${task.id}`} style={styles.taskMain} onPress={() => toggleItem(task)}>
                  <View style={[styles.checkbox, task.status === 'completed' && styles.checkboxDone]}>
                    {task.status === 'completed' && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                  <View style={styles.taskInfo}>
                    <Text style={[styles.taskTitle, task.status === 'completed' && styles.taskDone]}>{task.title}</Text>
                    {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}
                    <View style={styles.taskMeta}>
                      {task.requires_photo && (
                        <View style={[styles.metaBadge, (photos[task.id]?.length > 0) && styles.metaBadgeComplete]}>
                          <Ionicons name="camera" size={12} color={(photos[task.id]?.length > 0) ? Colors.greenReady : Colors.blueAssigned} />
                          <Text style={[styles.metaText, (photos[task.id]?.length > 0) && { color: Colors.greenReady }]}>
                            {(photos[task.id]?.length > 0) ? `${photos[task.id].length} photo(s)` : 'Photo required'}
                          </Text>
                        </View>
                      )}
                      {task.requires_before_after && (
                        <View style={styles.metaBadge}>
                          <Ionicons name="swap-horizontal" size={12} color={Colors.purpleAwaiting} />
                          <Text style={styles.metaText}>Before & After</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                {/* Photo action buttons */}
                <View style={styles.photoActions}>
                  <TouchableOpacity testID={`photo-camera-${task.id}`} style={styles.photoBtn} onPress={() => takePhoto(task)}>
                    {uploading === task.id ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <Ionicons name="camera" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity testID={`photo-gallery-${task.id}`} style={styles.photoBtn} onPress={() => pickPhoto(task)}>
                    <Ionicons name="images" size={20} color={Colors.secondary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  progressHeader: { backgroundColor: Colors.surface, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  progressTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  progressPercent: { fontSize: 14, fontWeight: '700' },
  progressBar: { height: 8, backgroundColor: Colors.surfaceSecondary, borderRadius: 4 },
  progressFill: { height: 8, backgroundColor: Colors.greenReady, borderRadius: 4 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.greenReady, borderRadius: 10, paddingVertical: 12 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  list: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 30 },
  roomSection: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  roomHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: Colors.border },
  roomTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  roomCount: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  taskRow: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  taskMain: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, paddingBottom: Spacing.xs },
  checkbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkboxDone: { backgroundColor: Colors.greenReady, borderColor: Colors.greenReady },
  taskInfo: { flex: 1, gap: 2 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  taskDone: { textDecorationLine: 'line-through', color: Colors.grayInactive },
  taskDesc: { fontSize: 12, color: Colors.textSecondary },
  taskMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  metaBadgeComplete: { backgroundColor: Colors.greenReady + '15' },
  metaText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  photoActions: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, marginLeft: 40 },
  photoBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
});
