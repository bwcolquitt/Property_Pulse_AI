import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, ActivityIndicator, Alert, Platform, Switch, Modal, TextInput, ScrollView } from 'react-native';
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
  const [typeFilter, setTypeFilter] = useState<'all' | 'cleaning' | 'maintenance' | 'pool'>('all');
  // Issue reporting
  const [issueModal, setIssueModal] = useState<any>(null); // null or {floor, room_name} or {global: true}
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [issuePriority, setIssuePriority] = useState('medium');
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issuePhotos, setIssuePhotos] = useState<string[]>([]);
  // Workflow hints
  const [hints, setHints] = useState<any[]>([]);
  const [showHints, setShowHints] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

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

  // Fetch workflow hints
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get('/issues-v2/workflow-hints'); setHints(data); } catch {}
    })();
  }, []);

  const submitIssue = async () => {
    if (!issueTitle.trim()) { Alert.alert('Required', 'Enter an issue title'); return; }
    setIssueSubmitting(true);
    try {
      const turnover = await api.get(`/turnovers/${id}`);
      const propId = turnover.data?.property_id;
      const { data: issue } = await api.post('/issues-v2/quick-report', {
        property_id: propId,
        turnover_id: id,
        title: issueTitle,
        description: issueDesc,
        floor: issueModal?.floor || '',
        room_name: issueModal?.room_name || '',
        trade_type: issueModal?.room_name?.toLowerCase().includes('spa') || issueModal?.room_name?.toLowerCase().includes('pool') ? 'pool' : 'general',
        priority: issuePriority,
      });
      // Upload photos to the issue
      for (const photo of issuePhotos) {
        try {
          await api.post('/media/upload', { owner_type: 'issue', owner_id: issue.id, media_type: 'photo', base64_data: photo });
        } catch {}
      }
      Alert.alert('Issue Reported', `Admin has been notified.${issuePhotos.length > 0 ? ` ${issuePhotos.length} photo(s) attached.` : ''}`);
      setIssueModal(null);
      setIssueTitle('');
      setIssueDesc('');
      setIssuePriority('medium');
      setIssuePhotos([]);
    } catch (e) { Alert.alert('Error', 'Failed to submit issue'); }
    finally { setIssueSubmitting(false); }
  };

  const addIssuePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
      if (!result.canceled && result.assets[0]?.base64) {
        setIssuePhotos(prev => [...prev, result.assets[0].base64!]);
      }
    } catch {}
  };

  const takeIssuePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { addIssuePhoto(); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
      if (!result.canceled && result.assets[0]?.base64) {
        setIssuePhotos(prev => [...prev, result.assets[0].base64!]);
      }
    } catch { addIssuePhoto(); }
  };

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

  const moveItem = async (itemId: string, direction: 'up' | 'down') => {
    const idx = items.findIndex(i => i.id === itemId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const newItems = [...items];
    [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];
    setItems(newItems);
    // Save new order to backend
    try {
      await api.post('/admin/reorder-checklist', { turnover_id: id, item_order: newItems.map(i => i.id) });
    } catch {}
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
    filteredItems = filteredItems.filter(i => {
      if (typeFilter === 'pool') return i.room_name?.toLowerCase().includes('pool') || i.room_name?.toLowerCase().includes('spa') || i.room_name?.toLowerCase().includes('hot tub');
      return i.checklist_type === typeFilter || i.checklist_type === 'both';
    });
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
      {/* Property Header with Issue Report Icon */}
      {property && (
        <View style={styles.propertyHeader}>
          <View style={styles.propHeaderRow}>
            <View style={{flex: 1}}>
              <Text style={styles.propertyNickname}>{property.nickname || property.name}</Text>
              <Text style={styles.propertyAddress}>{property.address_1}, {property.city}, {property.state}</Text>
            </View>
            <TouchableOpacity testID="global-issue-btn" style={styles.issueBtn} onPress={() => setIssueModal({ global: true, floor: '', room_name: '' })}>
              <Ionicons name="warning" size={22} color={Colors.redUrgent} />
            </TouchableOpacity>
            <TouchableOpacity testID="workflow-hints-btn" style={styles.hintsBtn} onPress={() => setShowHints(!showHints)}>
              <Ionicons name="bulb" size={22} color={Colors.accent} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Workflow Hints Banner */}
      {showHints && hints.length > 0 && (
        <View style={styles.hintsBanner}>
          <View style={styles.hintsHeader}><Ionicons name="bulb" size={16} color={Colors.accent} /><Text style={styles.hintsTitle}>Smart Workflow Tips</Text></View>
          {hints.map((h: any, i: number) => (
            <View key={i} style={styles.hintRow}><Text style={styles.hintCategory}>{h.category}</Text><Text style={styles.hintText}>{h.hint}</Text></View>
          ))}
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
          {(['all', 'cleaning', 'maintenance', 'pool'] as const).map(t => (
            <TouchableOpacity key={t} testID={`type-filter-${t}`} style={[styles.typeBtn, typeFilter === t && styles.typeBtnActive]} onPress={() => setTypeFilter(t)}>
              <Ionicons name={t === 'all' ? 'list' : t === 'cleaning' ? 'sparkles' : t === 'pool' ? 'water' : 'construct'} size={14} color={typeFilter === t ? Colors.primaryForeground : Colors.textSecondary} />
              <Text style={[styles.typeBtnText, typeFilter === t && styles.typeBtnTextActive]}>{t === 'all' ? 'All' : t === 'cleaning' ? 'Clean' : t === 'pool' ? 'Pool/Spa' : 'Maint.'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.toggleRow}>
          <TouchableOpacity testID="reorder-toggle" style={[styles.reorderBtn, reorderMode && styles.reorderBtnActive]} onPress={() => setReorderMode(!reorderMode)}>
            <Ionicons name="swap-vertical" size={16} color={reorderMode ? Colors.primaryForeground : Colors.textSecondary} />
          </TouchableOpacity>
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
            <TouchableOpacity testID={`issue-floor-${section.title}`} style={styles.floorIssueBtn} onPress={() => setIssueModal({ floor: section.title, room_name: '' })}>
              <Ionicons name="warning" size={16} color={Colors.redUrgent} />
            </TouchableOpacity>
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
              {/* Photo buttons + Reorder arrows */}
              <View style={styles.photoActions}>
                {reorderMode && (
                  <View style={styles.reorderArrows}>
                    <TouchableOpacity testID={`move-up-${task.id}`} style={styles.arrowBtn} onPress={() => moveItem(task.id, 'up')}>
                      <Ionicons name="arrow-up" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity testID={`move-down-${task.id}`} style={styles.arrowBtn} onPress={() => moveItem(task.id, 'down')}>
                      <Ionicons name="arrow-down" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                )}
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

      {/* Issue Report Modal */}
      <Modal visible={!!issueModal} transparent animationType="fade" onRequestClose={() => setIssueModal(null)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modal}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="warning" size={22} color={Colors.redUrgent} />
                <Text style={styles.modalTitle}>Report Issue</Text>
              </View>
              {issueModal?.floor && <Text style={styles.modalLocation}>Location: {issueModal.floor}{issueModal.room_name ? ` - ${issueModal.room_name}` : ''}</Text>}
              {issueModal?.global && <Text style={styles.modalLocation}>General property issue</Text>}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Issue Title *</Text>
                <TextInput testID="issue-title-input" style={styles.textInput} placeholder="e.g., Broken spa jet" placeholderTextColor={Colors.grayInactive} value={issueTitle} onChangeText={setIssueTitle} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput testID="issue-desc-input" style={[styles.textInput, { height: 80 }]} placeholder="Describe the issue in detail..." placeholderTextColor={Colors.grayInactive} value={issueDesc} onChangeText={setIssueDesc} multiline />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Priority</Text>
                <View style={styles.priorityRow}>
                  {['low', 'medium', 'high', 'urgent'].map(p => (
                    <TouchableOpacity key={p} testID={`priority-${p}`} style={[styles.priorityBtn, issuePriority === p && { backgroundColor: p === 'urgent' ? Colors.redUrgent : p === 'high' ? Colors.accent : p === 'medium' ? Colors.yellowAtRisk : Colors.greenReady, borderColor: 'transparent' }]} onPress={() => setIssuePriority(p)}>
                      <Text style={[styles.priorityBtnText, issuePriority === p && { color: '#fff' }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* Photo Attachments */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Photos ({issuePhotos.length})</Text>
                <View style={styles.issuePhotoRow}>
                  <TouchableOpacity testID="issue-photo-camera" style={styles.issuePhotoBtn} onPress={takeIssuePhoto}>
                    <Ionicons name="camera" size={22} color={Colors.primary} />
                    <Text style={styles.issuePhotoBtnText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="issue-photo-gallery" style={styles.issuePhotoBtn} onPress={addIssuePhoto}>
                    <Ionicons name="images" size={22} color={Colors.secondary} />
                    <Text style={styles.issuePhotoBtnText}>Gallery</Text>
                  </TouchableOpacity>
                  {issuePhotos.length > 0 && (
                    <View style={styles.issuePhotoCount}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.greenReady} />
                      <Text style={styles.issuePhotoCountText}>{issuePhotos.length} attached</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setIssueModal(null)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="submit-issue-btn" style={styles.modalSubmit} onPress={submitIssue} disabled={issueSubmitting}>
                  {issueSubmitting ? <ActivityIndicator color="#fff" /> : <><Ionicons name="send" size={16} color="#fff" /><Text style={styles.modalSubmitText}>Report</Text></>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  // Property Header
  propertyHeader: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  propHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  propertyNickname: { fontSize: 20, fontWeight: '800', color: Colors.primaryForeground },
  propertyAddress: { fontSize: 13, color: Colors.primaryForeground + 'CC', marginTop: 2 },
  issueBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  hintsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  // Workflow Hints
  hintsBanner: { backgroundColor: Colors.accent + '12', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.accent + '30' },
  hintsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  hintsTitle: { fontSize: 14, fontWeight: '700', color: Colors.accent },
  hintRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingLeft: 4 },
  hintCategory: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', width: 60 },
  hintText: { fontSize: 12, color: Colors.textPrimary, flex: 1, lineHeight: 17 },
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
  // Reorder
  reorderBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  reorderBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  reorderArrows: { flexDirection: 'row', gap: 4 },
  arrowBtn: { width: 30, height: 30, borderRadius: 6, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.primary + '30' },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  // Floor Issue Button
  floorIssueBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.redUrgent + '12', justifyContent: 'center', alignItems: 'center' },
  // Issue Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalScroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, gap: Spacing.md },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalLocation: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },
  inputGroup: { gap: 4 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  textInput: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  priorityBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'capitalize' },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
  modalCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  modalSubmit: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: Colors.redUrgent },
  modalSubmitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // Issue photo attachment
  issuePhotoRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  issuePhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  issuePhotoBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  issuePhotoCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  issuePhotoCountText: { fontSize: 12, fontWeight: '600', color: Colors.greenReady },
});
