import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const FIELDS = [
  { key: 'garage_code', label: 'Garage Door Code', icon: 'car', placeholder: '#1234' },
  { key: 'front_door_code', label: 'Front Door Code', icon: 'key', placeholder: '5678' },
  { key: 'lockbox_code', label: 'Lockbox Code', icon: 'lock-closed', placeholder: '9876' },
  { key: 'gate_code', label: 'Gate Code', icon: 'business', placeholder: '#4321' },
  { key: 'owner_storage_code', label: 'Owner Storage Code', icon: 'cube', placeholder: '1111' },
  { key: 'alarm_code', label: 'Alarm Code', icon: 'shield', placeholder: '0000' },
  { key: 'wifi_network', label: 'WiFi Network', icon: 'wifi', placeholder: 'PropertyGuest' },
  { key: 'wifi_password', label: 'WiFi Password', icon: 'key', placeholder: 'beach2025' },
  { key: 'pool_pump_location', label: 'Pool Pump Location', icon: 'water', placeholder: 'Side yard behind gate' },
  { key: 'breaker_panel_location', label: 'Breaker Panel', icon: 'flash', placeholder: 'Garage left wall' },
  { key: 'water_shutoff_location', label: 'Water Shutoff', icon: 'water', placeholder: 'Front yard near sidewalk' },
  { key: 'trash_day', label: 'Trash Day', icon: 'trash', placeholder: 'Tuesday & Friday' },
];

export default function PropertyNotesScreen() {
  const { propertyId } = useLocalSearchParams();
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedProp, setSelectedProp] = useState(propertyId as string || '');
  const [notes, setNotes] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');

  useEffect(() => {
    api.get('/properties').then(r => {
      setProperties(r.data);
      if (!selectedProp && r.data.length) setSelectedProp(r.data[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedProp) {
      api.get(`/property-notes/${selectedProp}`).then(r => {
        setNotes(r.data || {});
        setSpecialInstructions(r.data?.special_instructions || '');
      }).catch(() => {});
    }
  }, [selectedProp]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/property-notes/${selectedProp}`, { ...notes, property_id: selectedProp, special_instructions: specialInstructions });
      Alert.alert('Saved', 'Service notes updated');
    } catch { Alert.alert('Error', 'Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="document-lock" size={24} color={Colors.primary} />
        <Text style={styles.title}>Service Crew Notes</Text>
        <Text style={styles.subtitle}>Codes, WiFi, and key property info for your service team</Text>
      </View>

      <Text style={styles.label}>Property</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.chipRow}>
        {properties.map(p => (<TouchableOpacity key={p.id} style={[styles.chip, selectedProp === p.id && styles.chipActive]} onPress={() => setSelectedProp(p.id)}><Text style={[styles.chipText, selectedProp === p.id && { color: '#fff' }]}>{p.nickname || p.name}</Text></TouchableOpacity>))}
      </View></ScrollView>

      <View style={styles.crewBadge}>
        <Ionicons name="eye-off" size={14} color={Colors.blueAssigned} />
        <Text style={styles.crewBadgeText}>Only visible to service crew — not guests</Text>
      </View>

      {FIELDS.map(f => (
        <View key={f.key} style={styles.fieldRow}>
          <View style={styles.fieldIcon}><Ionicons name={f.icon as any} size={16} color={Colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <TextInput style={styles.input} value={notes[f.key] || ''} onChangeText={v => setNotes({...notes, [f.key]: v})} placeholder={f.placeholder} placeholderTextColor={Colors.grayInactive} />
          </View>
        </View>
      ))}

      <Text style={styles.sectionLabel}>Special Instructions</Text>
      <TextInput style={[styles.input, { height: 100 }]} value={specialInstructions} onChangeText={setSpecialInstructions} placeholder="Any other info the crew needs (parking instructions, tricky locks, hidden utilities, etc.)" multiline placeholderTextColor={Colors.grayInactive} />

      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.saveBtnText}>Save Notes</Text></>}
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  header: { gap: 4 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  crewBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.blueAssigned + '10', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.blueAssigned + '25' },
  crewBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.blueAssigned },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fieldIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.primary + '10', justifyContent: 'center', alignItems: 'center' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
