import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GuestBookScreen() {
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProp, setSelectedProp] = useState<any>(null);
  const [form, setForm] = useState({ guest_name: '', guest_email: '', guest_phone: '', check_in_date: '', check_out_date: '', adults: '2', children: '0', infants: '0', pets: false, special_requests: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/guest-booking/properties');
        setProperties(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const submitBooking = async () => {
    if (!selectedProp) { Alert.alert('Required', 'Select a property'); return; }
    if (!form.guest_name || !form.guest_email) { Alert.alert('Required', 'Enter your name and email'); return; }
    if (!form.check_in_date || !form.check_out_date) { Alert.alert('Required', 'Enter check-in and check-out dates'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post('/guest-booking/book', {
        property_id: selectedProp.id,
        guest_name: form.guest_name,
        guest_email: form.guest_email,
        guest_phone: form.guest_phone,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        adults: parseInt(form.adults) || 1,
        children: parseInt(form.children) || 0,
        infants: parseInt(form.infants) || 0,
        pets: form.pets,
        special_requests: form.special_requests,
      });
      setSuccess(data);
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Booking failed. Please try again.';
      Alert.alert('Error', msg);
    }
    finally { setSubmitting(false); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  if (success) {
    return (
      <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.successContent}>
        <View style={styles.successCard}>
          <Ionicons name="checkmark-circle" size={64} color={Colors.greenReady} />
          <Text style={styles.successTitle}>Booking Submitted!</Text>
          <Text style={styles.successMsg}>{success.message}</Text>
          <View style={styles.successDetails}>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Property</Text><Text style={styles.detailVal}>{success.property_name}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Check-in</Text><Text style={styles.detailVal}>{success.check_in}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Check-out</Text><Text style={styles.detailVal}>{success.check_out}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Guests</Text><Text style={styles.detailVal}>{success.guest_count}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Booking ID</Text><Text style={styles.detailVal}>{success.booking_id?.slice(-8)}</Text></View>
            <View style={[styles.statusBadge, { backgroundColor: Colors.yellowAtRisk + '15' }]}><Text style={[styles.statusText, { color: Colors.yellowAtRisk }]}>Pending Confirmation</Text></View>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.brandText}><Text style={{ color: '#0A4F7F' }}>Property</Text><Text style={{ color: '#DDA239' }}> Pulse</Text><Text style={{ color: '#0A4F7F' }}> AI</Text></Text>
        <Text style={styles.headerTitle}>Book Your Stay</Text>
        <Text style={styles.headerSub}>Select a property, choose your dates, and reserve directly.</Text>
      </View>

      {/* Property Selection */}
      <Text style={styles.sectionTitle}>Choose a Property</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propRow}>
        {properties.map(p => (
          <TouchableOpacity key={p.id} style={[styles.propCard, selectedProp?.id === p.id && styles.propCardActive]} onPress={() => setSelectedProp(p)}>
            {p.cover_photo_url ? (
              <Image source={{ uri: p.cover_photo_url }} style={styles.propImage} />
            ) : (
              <View style={[styles.propImage, { backgroundColor: Colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="home" size={32} color={Colors.grayInactive} />
              </View>
            )}
            <View style={styles.propInfo}>
              <Text style={styles.propName}>{p.name}</Text>
              <Text style={styles.propAddr}>{p.address}</Text>
              <View style={styles.propMeta}>
                <Text style={styles.propMetaText}>{p.bedrooms} bed</Text>
                <Text style={styles.propMetaText}>{p.bathrooms} bath</Text>
                <Text style={styles.propMetaText}>Sleeps {p.sleeps}</Text>
              </View>
            </View>
            {selectedProp?.id === p.id && <View style={styles.checkMark}><Ionicons name="checkmark-circle" size={24} color={Colors.greenReady} /></View>}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Guest Info */}
      <Text style={styles.sectionTitle}>Your Information</Text>
      <View style={styles.formSection}>
        <TextInput style={styles.input} value={form.guest_name} onChangeText={v => setForm({...form, guest_name: v})} placeholder="Full Name *" placeholderTextColor={Colors.grayInactive} />
        <TextInput style={styles.input} value={form.guest_email} onChangeText={v => setForm({...form, guest_email: v})} placeholder="Email *" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.grayInactive} />
        <TextInput style={styles.input} value={form.guest_phone} onChangeText={v => setForm({...form, guest_phone: v})} placeholder="Phone (optional)" keyboardType="phone-pad" placeholderTextColor={Colors.grayInactive} />
      </View>

      {/* Dates */}
      <Text style={styles.sectionTitle}>Dates (YYYY-MM-DD)</Text>
      <View style={styles.dateRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dateLabel}>Check-in</Text>
          <TextInput style={styles.input} value={form.check_in_date} onChangeText={v => setForm({...form, check_in_date: v})} placeholder="2025-07-01" placeholderTextColor={Colors.grayInactive} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dateLabel}>Check-out</Text>
          <TextInput style={styles.input} value={form.check_out_date} onChangeText={v => setForm({...form, check_out_date: v})} placeholder="2025-07-05" placeholderTextColor={Colors.grayInactive} />
        </View>
      </View>

      {/* Guest Count */}
      <Text style={styles.sectionTitle}>Guests</Text>
      <View style={styles.guestRow}>
        <View style={styles.guestCol}><Text style={styles.guestLabel}>Adults</Text><TextInput style={styles.guestInput} value={form.adults} onChangeText={v => setForm({...form, adults: v})} keyboardType="numeric" /></View>
        <View style={styles.guestCol}><Text style={styles.guestLabel}>Children</Text><TextInput style={styles.guestInput} value={form.children} onChangeText={v => setForm({...form, children: v})} keyboardType="numeric" /></View>
        <View style={styles.guestCol}><Text style={styles.guestLabel}>Infants</Text><TextInput style={styles.guestInput} value={form.infants} onChangeText={v => setForm({...form, infants: v})} keyboardType="numeric" /></View>
      </View>

      <TouchableOpacity style={styles.petToggle} onPress={() => setForm({...form, pets: !form.pets})}>
        <Ionicons name={form.pets ? 'checkbox' : 'square-outline'} size={22} color={form.pets ? Colors.primary : Colors.grayInactive} />
        <Text style={styles.petText}>Traveling with pets</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Special Requests</Text>
      <TextInput style={[styles.input, { height: 80 }]} value={form.special_requests} onChangeText={v => setForm({...form, special_requests: v})} placeholder="Early check-in, late check-out, etc." multiline placeholderTextColor={Colors.grayInactive} />

      {/* Submit */}
      <TouchableOpacity style={styles.bookBtn} onPress={submitBooking} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <><Ionicons name="calendar-outline" size={20} color="#fff" /><Text style={styles.bookBtnText}>Request Booking</Text></>}
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  header: { alignItems: 'center', paddingVertical: Spacing.lg },
  brandText: { fontSize: 22, fontWeight: '800', marginBottom: Spacing.sm },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.sm },
  propRow: { gap: Spacing.sm, paddingVertical: Spacing.sm },
  propCard: { width: 220, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden' },
  propCardActive: { borderColor: Colors.primary, borderWidth: 2 },
  propImage: { width: '100%', height: 120 },
  propInfo: { padding: Spacing.sm, gap: 2 },
  propName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  propAddr: { fontSize: 12, color: Colors.textSecondary },
  propMeta: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  propMetaText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  checkMark: { position: 'absolute', top: 8, right: 8 },
  formSection: { gap: Spacing.sm },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  dateRow: { flexDirection: 'row', gap: Spacing.sm },
  dateLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  guestRow: { flexDirection: 'row', gap: Spacing.sm },
  guestCol: { flex: 1, alignItems: 'center', gap: 4 },
  guestLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  guestInput: { width: '100%', textAlign: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 10, paddingVertical: 10, fontSize: 18, fontWeight: '700', borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  petToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  petText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, marginTop: Spacing.md },
  bookBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  successContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  successCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.greenReady + '30' },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.greenReady },
  successMsg: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  successDetails: { width: '100%', gap: 8, marginTop: Spacing.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailLabel: { fontSize: 13, color: Colors.textSecondary },
  detailVal: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  statusBadge: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10, marginTop: 8 },
  statusText: { fontSize: 13, fontWeight: '700' },
});
