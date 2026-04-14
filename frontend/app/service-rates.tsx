import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import api from '../src/utils/api';

export default function ServiceRatesScreen() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const isAdmin = user?.role === 'super_admin' || user?.role === 'property_manager';

  const fetch = async () => {
    try {
      const { data } = await api.get('/service-settings');
      setSettings(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const startEdit = (s: any) => {
    setEditing(s.trade_type);
    setEditValues({ hourly_rate: String(s.hourly_rate), emergency_rate: String(s.emergency_rate), materials_markup: String(s.materials_markup), minimum_charge: String(s.minimum_charge), travel_fee: String(s.travel_fee), company_name: s.company_name || '' });
  };

  const saveEdit = async (tradeType: string) => {
    try {
      await api.put(`/service-settings/${tradeType}`, {
        hourly_rate: parseFloat(editValues.hourly_rate) || 0,
        emergency_rate: parseFloat(editValues.emergency_rate) || 0,
        materials_markup: parseFloat(editValues.materials_markup) || 1.0,
        minimum_charge: parseFloat(editValues.minimum_charge) || 0,
        travel_fee: parseFloat(editValues.travel_fee) || 0,
        company_name: editValues.company_name,
      });
      Alert.alert('Saved', 'Service rates updated. AI estimates will use these new rates.');
      setEditing(null);
      fetch();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to save');
    }
  };

  const tradeIcons: Record<string, string> = { general: 'construct', plumbing: 'water', electrical: 'flash', hvac: 'thermometer', pool: 'water', cleaning: 'sparkles', appliance: 'tv' };
  const tradeColors: Record<string, string> = { general: Colors.textSecondary, plumbing: Colors.blueAssigned, electrical: Colors.accent, hvac: Colors.redUrgent, pool: Colors.secondary, cleaning: Colors.purpleAwaiting, appliance: Colors.primary };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Service Company Rates</Text>
      <Text style={styles.subtitle}>These rates are used by AI to estimate repair costs. {isAdmin ? 'Tap edit to update.' : 'Contact admin to change rates.'}</Text>

      {settings.map((s, i) => {
        const isEditing = editing === s.trade_type;
        const color = tradeColors[s.trade_type] || Colors.grayInactive;
        return (
          <View key={i} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.tradeIcon, { backgroundColor: color + '15' }]}>
                <Ionicons name={(tradeIcons[s.trade_type] || 'construct') as any} size={22} color={color} />
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.tradeName}>{s.trade_type.replace(/_/g, ' ')}</Text>
                <Text style={styles.companyName}>{s.company_name}</Text>
              </View>
              {isAdmin && !isEditing && (
                <TouchableOpacity testID={`edit-${s.trade_type}`} style={styles.editBtn} onPress={() => startEdit(s)}>
                  <Ionicons name="pencil" size={16} color={Colors.primary} />
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {isEditing ? (
              <View style={styles.editForm}>
                <View style={styles.editRow}>
                  <View style={styles.editField}>
                    <Text style={styles.fieldLabel}>Company</Text>
                    <TextInput style={styles.fieldInput} value={editValues.company_name} onChangeText={v => setEditValues({ ...editValues, company_name: v })} />
                  </View>
                </View>
                <View style={styles.editRow}>
                  <View style={styles.editField}>
                    <Text style={styles.fieldLabel}>Hourly Rate</Text>
                    <TextInput style={styles.fieldInput} value={editValues.hourly_rate} onChangeText={v => setEditValues({ ...editValues, hourly_rate: v })} keyboardType="numeric" />
                  </View>
                  <View style={styles.editField}>
                    <Text style={styles.fieldLabel}>Emergency Rate</Text>
                    <TextInput style={styles.fieldInput} value={editValues.emergency_rate} onChangeText={v => setEditValues({ ...editValues, emergency_rate: v })} keyboardType="numeric" />
                  </View>
                </View>
                <View style={styles.editRow}>
                  <View style={styles.editField}>
                    <Text style={styles.fieldLabel}>Min Charge</Text>
                    <TextInput style={styles.fieldInput} value={editValues.minimum_charge} onChangeText={v => setEditValues({ ...editValues, minimum_charge: v })} keyboardType="numeric" />
                  </View>
                  <View style={styles.editField}>
                    <Text style={styles.fieldLabel}>Travel Fee</Text>
                    <TextInput style={styles.fieldInput} value={editValues.travel_fee} onChangeText={v => setEditValues({ ...editValues, travel_fee: v })} keyboardType="numeric" />
                  </View>
                </View>
                <View style={styles.editRow}>
                  <View style={styles.editField}>
                    <Text style={styles.fieldLabel}>Materials Markup</Text>
                    <TextInput style={styles.fieldInput} value={editValues.materials_markup} onChangeText={v => setEditValues({ ...editValues, materials_markup: v })} keyboardType="numeric" />
                  </View>
                </View>
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID={`save-${s.trade_type}`} style={styles.saveBtn} onPress={() => saveEdit(s.trade_type)}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.saveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.ratesGrid}>
                <View style={styles.rateItem}><Text style={styles.rateValue}>${s.hourly_rate}</Text><Text style={styles.rateLabel}>Hourly</Text></View>
                <View style={styles.rateItem}><Text style={styles.rateValue}>${s.emergency_rate}</Text><Text style={styles.rateLabel}>Emergency</Text></View>
                <View style={styles.rateItem}><Text style={styles.rateValue}>${s.minimum_charge}</Text><Text style={styles.rateLabel}>Minimum</Text></View>
                <View style={styles.rateItem}><Text style={styles.rateValue}>${s.travel_fee}</Text><Text style={styles.rateLabel}>Travel</Text></View>
                <View style={styles.rateItem}><Text style={styles.rateValue}>{s.materials_markup}x</Text><Text style={styles.rateLabel}>Markup</Text></View>
              </View>
            )}
            {s.notes && !isEditing && <Text style={styles.notes}>{s.notes}</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tradeIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1 },
  tradeName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, textTransform: 'capitalize' },
  companyName: { fontSize: 12, color: Colors.textSecondary },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '12', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  editText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  ratesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rateItem: { alignItems: 'center', minWidth: 60 },
  rateValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  rateLabel: { fontSize: 10, color: Colors.textSecondary },
  notes: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },
  editForm: { gap: Spacing.sm },
  editRow: { flexDirection: 'row', gap: Spacing.sm },
  editField: { flex: 1, gap: 2 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  fieldInput: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontWeight: '600', color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, flexDirection: 'row', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, backgroundColor: Colors.primary },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
