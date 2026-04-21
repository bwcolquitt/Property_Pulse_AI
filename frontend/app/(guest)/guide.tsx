import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/constants/theme';
import api from '../../src/utils/api';

export default function GuestGuideScreen() {
  const [stay, setStay] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [departureChecklist, setDepartureChecklist] = useState<Record<string, boolean>>({});
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [lateModal, setLateModal] = useState(false);
  const [lateTime, setLateTime] = useState('');
  const [lateReason, setLateReason] = useState('');

  useEffect(() => { api.get('/guest-portal/my-stay').then(r => setStay(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);

  const DEPARTURE_ITEMS = [
    'Start the dishwasher',
    'Take out all trash to the bins',
    'Strip beds and leave linens in a pile',
    'Turn off all lights and fans',
    'Close and lock all windows',
    'Set thermostat to 72°F',
    'Lock all doors',
    'Return keys / lock lockbox',
  ];

  const allChecked = DEPARTURE_ITEMS.every(item => departureChecklist[item]);
  const rules = stay?.config?.house_rules || {};
  const checkInOut = stay?.config?.check_in_out || {};
  const emergProcs = stay?.config?.emergency_procedures?.procedures || [];

  const doCheckout = async () => {
    try {
      const { data } = await api.post('/guest-portal/checkout', {
        reservation_id: stay?.reservation?.id || '',
        feedback, rating,
        departure_checklist_completed: allChecked,
      });
      Alert.alert('Checked Out!', data.message);
      setCheckoutModal(false);
    } catch { Alert.alert('Error', 'Checkout failed'); }
  };

  const requestLate = async () => {
    try {
      const { data } = await api.post('/guest-portal/late-checkout', {
        reservation_id: stay?.reservation?.id || '',
        requested_time: lateTime, reason: lateReason,
      });
      Alert.alert('Submitted', data.message);
      setLateModal(false);
    } catch { Alert.alert('Error', 'Request failed'); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Check-in Instructions */}
      <View style={styles.section}>
        <View style={styles.sectionHead}><Ionicons name="key" size={20} color={Colors.blueAssigned} /><Text style={styles.sectionTitle}>Check-in / Check-out</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Check-in</Text><Text style={styles.infoVal}>{checkInOut.default_check_in_time || '3:00 PM'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Check-out</Text><Text style={styles.infoVal}>{checkInOut.default_check_out_time || '11:00 AM'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Key</Text><Text style={styles.infoVal}>{checkInOut.key_exchange_method || 'See instructions'}</Text></View>
        {checkInOut.check_in_instructions && <Text style={styles.instructions}>{checkInOut.check_in_instructions}</Text>}
      </View>

      {/* House Rules */}
      <View style={styles.section}>
        <View style={styles.sectionHead}><Ionicons name="document-text" size={20} color={Colors.purpleAwaiting} /><Text style={styles.sectionTitle}>House Rules</Text></View>
        <View style={styles.ruleRow}><Ionicons name="moon" size={14} color={Colors.textSecondary} /><Text style={styles.ruleText}>Quiet hours: {rules.quiet_hours_start || '10 PM'} — {rules.quiet_hours_end || '8 AM'}</Text></View>
        {rules.parking_rules && <View style={styles.ruleRow}><Ionicons name="car" size={14} color={Colors.textSecondary} /><Text style={styles.ruleText}>Parking: {rules.parking_rules}</Text></View>}
        <View style={styles.ruleRow}><Ionicons name="paw" size={14} color={Colors.textSecondary} /><Text style={styles.ruleText}>Pets: {rules.pets_allowed ? 'Allowed' : 'Not allowed'}{rules.pet_rules ? ` — ${rules.pet_rules}` : ''}</Text></View>
        <View style={styles.ruleRow}><Ionicons name="flame" size={14} color={Colors.textSecondary} /><Text style={styles.ruleText}>{rules.smoking_allowed ? 'Smoking allowed in designated areas' : 'No smoking anywhere on property'}</Text></View>
        {rules.pool_hours && <View style={styles.ruleRow}><Ionicons name="water" size={14} color={Colors.textSecondary} /><Text style={styles.ruleText}>Pool: {rules.pool_hours}{rules.pool_rules ? ` — ${rules.pool_rules}` : ''}</Text></View>}
        {rules.trash_instructions && <View style={styles.ruleRow}><Ionicons name="trash" size={14} color={Colors.textSecondary} /><Text style={styles.ruleText}>Trash: {rules.trash_instructions}</Text></View>}
        {rules.additional_rules && <Text style={styles.instructions}>{rules.additional_rules}</Text>}
      </View>

      {/* Emergency Procedures */}
      {emergProcs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}><Ionicons name="medkit" size={20} color={Colors.redUrgent} /><Text style={styles.sectionTitle}>Emergencies</Text></View>
          <Text style={styles.emergencyFirst}>Always call 911 first for life-threatening emergencies</Text>
          {emergProcs.map((p: any, i: number) => p.instructions ? (
            <View key={i} style={styles.emergCard}><Text style={styles.emergTitle}>{p.title}</Text><Text style={styles.emergText}>{p.instructions}</Text>{p.contact_phone && <Text style={styles.emergPhone}>Call: {p.contact_phone}</Text>}</View>
          ) : null)}
        </View>
      )}

      {/* Departure Checklist */}
      <View style={styles.section}>
        <View style={styles.sectionHead}><Ionicons name="checkbox" size={20} color={Colors.greenReady} /><Text style={styles.sectionTitle}>Departure Checklist</Text></View>
        <Text style={styles.departureHint}>Complete before checking out</Text>
        {DEPARTURE_ITEMS.map((item, i) => (
          <TouchableOpacity key={i} style={styles.checkRow} onPress={() => setDepartureChecklist(prev => ({ ...prev, [item]: !prev[item] }))}>
            <View style={[styles.checkbox, departureChecklist[item] && styles.checkboxDone]}>
              {departureChecklist[item] && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={[styles.checkText, departureChecklist[item] && styles.checkTextDone]}>{item}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.checkoutActions}>
          <TouchableOpacity style={styles.lateBtn} onPress={() => setLateModal(true)}>
            <Ionicons name="time" size={16} color={Colors.accent} />
            <Text style={styles.lateBtnText}>Late Checkout</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.checkoutBtn, !allChecked && styles.checkoutBtnDisabled]} onPress={() => { if (allChecked) setCheckoutModal(true); else Alert.alert('Complete Checklist', 'Please complete all departure items before checking out'); }}>
            <Ionicons name="log-out" size={16} color="#fff" />
            <Text style={styles.checkoutBtnText}>Check Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Checkout Rating Modal */}
      <Modal visible={checkoutModal} transparent animationType="fade" onRequestClose={() => setCheckoutModal(false)}>
        <View style={styles.modalOverlay}><View style={styles.modal}>
          <Text style={styles.modalTitle}>How was your stay?</Text>
          <View style={styles.starRow}>{[1,2,3,4,5].map(s => (<TouchableOpacity key={s} onPress={() => setRating(s)}><Ionicons name={s <= rating ? 'star' : 'star-outline'} size={36} color={Colors.accent} /></TouchableOpacity>))}</View>
          <TextInput style={[styles.input, { height: 80 }]} value={feedback} onChangeText={setFeedback} placeholder="Any feedback? (optional)" multiline placeholderTextColor={Colors.grayInactive} />
          <TouchableOpacity style={styles.submitBtn} onPress={doCheckout}><Text style={styles.submitText}>Submit & Check Out</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setCheckoutModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* Late Checkout Modal */}
      <Modal visible={lateModal} transparent animationType="fade" onRequestClose={() => setLateModal(false)}>
        <View style={styles.modalOverlay}><View style={styles.modal}>
          <Text style={styles.modalTitle}>Request Late Checkout</Text>
          <Text style={styles.modalHint}>A fee of ${checkInOut.late_check_out_fee || 50} may apply</Text>
          <TextInput style={styles.input} value={lateTime} onChangeText={setLateTime} placeholder="Requested time (e.g., 2:00 PM)" placeholderTextColor={Colors.grayInactive} />
          <TextInput style={styles.input} value={lateReason} onChangeText={setLateReason} placeholder="Reason (optional)" placeholderTextColor={Colors.grayInactive} />
          <TouchableOpacity style={styles.submitBtn} onPress={requestLate}><Text style={styles.submitText}>Submit Request</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setLateModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  section: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 13, color: Colors.textSecondary },
  infoVal: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  instructions: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18, backgroundColor: Colors.surfaceSecondary, borderRadius: 8, padding: Spacing.sm },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 2 },
  ruleText: { flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  emergencyFirst: { fontSize: 13, fontWeight: '700', color: Colors.redUrgent, textAlign: 'center', paddingVertical: 4 },
  emergCard: { backgroundColor: Colors.redUrgent + '06', borderRadius: 8, padding: Spacing.sm, gap: 2, borderWidth: 1, borderColor: Colors.redUrgent + '15' },
  emergTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  emergText: { fontSize: 12, color: Colors.textSecondary },
  emergPhone: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  departureHint: { fontSize: 12, color: Colors.textSecondary },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxDone: { backgroundColor: Colors.greenReady, borderColor: Colors.greenReady },
  checkText: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  checkTextDone: { textDecorationLine: 'line-through', color: Colors.grayInactive },
  checkoutActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  lateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.accent, backgroundColor: Colors.accent + '08' },
  lateBtnText: { fontSize: 14, fontWeight: '700', color: Colors.accent },
  checkoutBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary },
  checkoutBtnDisabled: { backgroundColor: Colors.grayInactive },
  checkoutBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
  modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, gap: Spacing.sm, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalHint: { fontSize: 13, color: Colors.accent, fontWeight: '600' },
  starRow: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  input: { width: '100%', backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  submitBtn: { width: '100%', alignItems: 'center', paddingVertical: 14, borderRadius: 10, backgroundColor: Colors.primary },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, paddingVertical: 8 },
});
