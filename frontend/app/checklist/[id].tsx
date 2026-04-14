import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/constants/theme';
import api from '../../src/utils/api';

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams(); // turnover id
  const [checklist, setChecklist] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
          <Text style={styles.progressPercent}>{progress}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
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
              <TouchableOpacity key={task.id} testID={`task-${task.id}`} style={styles.taskRow} onPress={() => toggleItem(task)}>
                <View style={[styles.checkbox, task.status === 'completed' && styles.checkboxDone]}>
                  {task.status === 'completed' && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <View style={styles.taskInfo}>
                  <Text style={[styles.taskTitle, task.status === 'completed' && styles.taskDone]}>{task.title}</Text>
                  {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}
                  <View style={styles.taskMeta}>
                    {task.requires_photo && (
                      <View style={styles.metaBadge}><Ionicons name="camera" size={12} color={Colors.blueAssigned} /><Text style={styles.metaText}>Photo</Text></View>
                    )}
                    {task.requires_before_after && (
                      <View style={styles.metaBadge}><Ionicons name="swap-horizontal" size={12} color={Colors.purpleAwaiting} /><Text style={styles.metaText}>B&A</Text></View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
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
  progressHeader: { backgroundColor: Colors.surface, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  progressTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  progressPercent: { fontSize: 14, fontWeight: '700', color: Colors.greenReady },
  progressBar: { height: 8, backgroundColor: Colors.surfaceSecondary, borderRadius: 4 },
  progressFill: { height: 8, backgroundColor: Colors.greenReady, borderRadius: 4 },
  list: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 30 },
  roomSection: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  roomHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: Colors.border },
  roomTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  roomCount: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  checkbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkboxDone: { backgroundColor: Colors.greenReady, borderColor: Colors.greenReady },
  taskInfo: { flex: 1, gap: 2 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  taskDone: { textDecorationLine: 'line-through', color: Colors.grayInactive },
  taskDesc: { fontSize: 12, color: Colors.textSecondary },
  taskMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  metaText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
});
