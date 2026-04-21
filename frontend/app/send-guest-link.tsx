import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, Linking, Platform, TextInput, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';
import * as Clipboard from 'expo-clipboard';

const DEFAULT_BASE = typeof window !== 'undefined' && (window as any)?.location?.origin ? (window as any).location.origin : 'https://your-app.propertypulse.ai';

export default function SendGuestLinkScreen() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [linkModal, setLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loadingLink, setLoadingLink] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);

  const load = async () => {
    try {
      const [rRes, sRes] = await Promise.all([
        api.get('/reservations'),
        api.get('/sms/config').catch(() => ({ data: { enabled: false } })),
      ]);
      const now = new Date();
      const upcoming = (rRes.data || []).filter((r: any) => {
        if (!r.check_out_at) return true;
        try { return new Date(r.check_out_at) >= new Date(now.getTime() - 86400000); } catch { return true; }
      });
      setReservations(upcoming);
      setSmsEnabled(!!sRes.data?.enabled);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const generateLink = async (res: any) => {
    setSelected(res);
    setPhone(res.guest_phone || '');
    setEmail(res.guest_email || '');
    setLoadingLink(true);
    try {
      const { data } = await api.post('/guest-portal/send-link', {
        reservation_id: res.id,
        guest_phone: res.guest_phone || '',
        guest_email: res.guest_email || '',
      });
      const url = `${DEFAULT_BASE}/guest-access?token=${data.token}`;
      setLinkUrl(url);
      setLinkModal(true);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to generate link');
    } finally { setLoadingLink(false); }
  };

  const copyLink = async () => {
    try { await Clipboard.setStringAsync(linkUrl); Alert.alert('Copied', 'Link copied to clipboard. Paste into your PMS message to guest.'); } catch {}
  };

  const openEmail = () => {
    const subject = encodeURIComponent(`Welcome to ${selected?.property_name || 'your stay'}!`);
    const body = encodeURIComponent(`Hi ${selected?.guest_name?.split(' ')[0] || 'there'},\n\nYou can access your guest portal (WiFi, checkout, house guide, AI concierge) here:\n\n${linkUrl}\n\nThis link is valid for 30 days. No password needed.\n\nSee you soon!`);
    const to = email || '';
    const url = `mailto:${to}?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => Alert.alert('Email', 'Could not open email app. Copy the link instead.'));
  };

  const sendSms = async () => {
    if (!phone) { Alert.alert('Phone', 'Enter a phone number'); return; }
    try {
      const body = `Welcome! Access your ${selected?.property_name || 'rental'} guest portal (WiFi, checkout, house guide): ${linkUrl}`;
      const { data } = await api.post('/sms/send', { to: phone, body, purpose: 'check_in_link', reservation_id: selected?.id });
      Alert.alert(data.simulated ? 'Simulated' : data.success ? 'Sent' : 'Failed', data.message || 'SMS processed');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Send failed');
    }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Send Guest Access</Text>
        <Text style={styles.subtitle}>Generate a secure magic link for each guest. Share via any channel you prefer.</Text>
      </View>

      <FlatList
        data={reservations}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="bed-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No upcoming reservations</Text><Text style={styles.emptyHint}>Sync from your PMS or add reservations manually</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => generateLink(item)} disabled={loadingLink}>
            <View style={styles.iconBox}><Ionicons name="person-circle" size={28} color={Colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.guestName}>{item.guest_name || 'Guest'}</Text>
              <Text style={styles.guestProp}>{item.property_name || 'Property'}</Text>
              <Text style={styles.guestDates}>
                {item.check_in_at ? new Date(item.check_in_at).toLocaleDateString() : '—'} → {item.check_out_at ? new Date(item.check_out_at).toLocaleDateString() : '—'}
              </Text>
              <View style={styles.contactRow}>
                {item.guest_email ? <View style={styles.contactChip}><Ionicons name="mail" size={10} color={Colors.textSecondary} /><Text style={styles.contactText}>{item.guest_email}</Text></View> : null}
                {item.guest_phone ? <View style={styles.contactChip}><Ionicons name="call" size={10} color={Colors.textSecondary} /><Text style={styles.contactText}>{item.guest_phone}</Text></View> : null}
              </View>
            </View>
            <View style={styles.sendBtn}>
              {loadingLink && selected?.id === item.id ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="link" size={14} color="#fff" /><Text style={styles.sendBtnText}>Send Link</Text></>}
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Link Modal */}
      <Modal visible={linkModal} transparent animationType="slide" onRequestClose={() => setLinkModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Guest Magic Link</Text>
              <TouchableOpacity onPress={() => setLinkModal(false)}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>For: {selected?.guest_name} @ {selected?.property_name}</Text>

            <View style={styles.linkBox}>
              <Text style={styles.linkText} numberOfLines={2}>{linkUrl}</Text>
            </View>

            <Text style={styles.sectionLabel}>Share via</Text>

            {/* Copy (easiest - works with any channel incl. PMS messaging) */}
            <TouchableOpacity style={[styles.shareBtn, { backgroundColor: Colors.primary }]} onPress={copyLink}>
              <Ionicons name="copy" size={18} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.shareTitle}>Copy Link</Text>
                <Text style={styles.shareSub}>Paste into Hostaway, Airbnb message, iMessage, WhatsApp, anywhere</Text>
              </View>
            </TouchableOpacity>

            {/* Email */}
            <TouchableOpacity style={[styles.shareBtn, { backgroundColor: Colors.accent }]} onPress={openEmail}>
              <Ionicons name="mail" size={18} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.shareTitle}>Open in Email</Text>
                <Text style={styles.shareSub}>Launches your mail app with pre-filled message{email ? ` to ${email}` : ''}</Text>
              </View>
            </TouchableOpacity>

            {/* SMS */}
            <View style={[styles.shareCard, !smsEnabled && { opacity: 0.6 }]}>
              <View style={styles.shareCardRow}>
                <Ionicons name="chatbubbles" size={18} color={Colors.secondary} />
                <Text style={styles.shareTitle}>Send via SMS {smsEnabled ? '' : '(not configured)'}</Text>
              </View>
              {smsEnabled ? (
                <>
                  <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+15551234567" keyboardType="phone-pad" placeholderTextColor={Colors.grayInactive} />
                  <TouchableOpacity style={styles.smsBtn} onPress={sendSms}>
                    <Ionicons name="send" size={14} color="#fff" />
                    <Text style={styles.smsBtnText}>Send SMS</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.notConfigured}>Configure in More → SMS Delivery to enable automated texts</Text>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: Spacing.md },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary + '10', justifyContent: 'center', alignItems: 'center' },
  guestName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  guestProp: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  guestDates: { fontSize: 11, color: Colors.textPrimary, marginTop: 4, fontWeight: '600' },
  contactRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  contactChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  contactText: { fontSize: 10, color: Colors.textSecondary },
  sendBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  sendBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  emptyHint: { fontSize: 12, color: Colors.grayInactive, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '90%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalHint: { fontSize: 13, color: Colors.textSecondary },
  linkBox: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  linkText: { fontSize: 12, color: Colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', marginTop: 8 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md, borderRadius: 10 },
  shareTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  shareSub: { fontSize: 11, color: '#ffffffCC', marginTop: 2 },
  shareCard: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, padding: Spacing.md, gap: 6 },
  shareCardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  smsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.secondary },
  smsBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  notConfigured: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic' },
});
