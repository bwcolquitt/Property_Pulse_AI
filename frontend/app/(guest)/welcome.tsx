import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import api from '../../src/utils/api';
import * as Clipboard from 'expo-clipboard';

export default function GuestWelcomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stay, setStay] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/guest-portal/my-stay').then(r => setStay(r.data)).catch(e => console.error(e)).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const hostPhone = stay?.host_phone;
  const emergencyPhone = stay?.emergency_phone || '911';
  const wifi = stay?.wifi;
  const hoursLeft = stay?.hours_remaining;
  const checkOut = stay?.check_out_at ? new Date(stay.check_out_at) : null;
  const companyName = stay?.config?.profile?.company_name || 'Your Host';
  const welcomeMsg = stay?.config?.communication?.guest_welcome_message || `Welcome to your stay! We're thrilled to have you.`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero */}
      {stay?.property?.cover_photo_url ? (
        <Image source={{ uri: stay.property.cover_photo_url }} style={styles.heroImage} />
      ) : (
        <View style={[styles.heroImage, { backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="home" size={48} color="#fff" /></View>
      )}

      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Welcome, {user?.first_name || 'Guest'}!</Text>
        <Text style={styles.propName}>{stay?.property?.name}</Text>
        <Text style={styles.propAddr}>{stay?.property?.address}</Text>
        <Text style={styles.welcomeMsg}>{welcomeMsg}</Text>
        <Text style={styles.hostName}>— {companyName}</Text>
      </View>

      {/* Checkout Countdown */}
      {checkOut && (
        <View style={[styles.countdownCard, hoursLeft && hoursLeft < 4 && { borderColor: Colors.redUrgent }]}>
          <Ionicons name="time" size={22} color={hoursLeft && hoursLeft < 4 ? Colors.redUrgent : Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.countdownLabel}>Check-out</Text>
            <Text style={styles.countdownTime}>{checkOut.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {checkOut.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text>
            {hoursLeft !== null && <Text style={[styles.countdownHours, hoursLeft < 4 && { color: Colors.redUrgent }]}>{hoursLeft < 1 ? `${Math.round(hoursLeft * 60)} minutes remaining` : `${Math.floor(hoursLeft)} hours ${Math.round((hoursLeft % 1) * 60)} min remaining`}</Text>}
          </View>
        </View>
      )}

      {/* WiFi Card */}
      {wifi?.network && (
        <TouchableOpacity style={styles.wifiCard} onPress={async () => {
          try { await Clipboard.setStringAsync(wifi.password); } catch {}
          alert('WiFi password copied!');
        }}>
          <Ionicons name="wifi" size={24} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.wifiLabel}>WiFi Network</Text>
            <Text style={styles.wifiName}>{wifi.network}</Text>
            <Text style={styles.wifiPass}>Password: {wifi.password}</Text>
          </View>
          <View style={styles.copyBtn}><Ionicons name="copy" size={16} color={Colors.primary} /><Text style={styles.copyText}>Copy</Text></View>
        </TouchableOpacity>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickGrid}>
        {hostPhone && (
          <TouchableOpacity style={styles.quickBtn} onPress={() => Linking.openURL(`tel:${hostPhone}`)}>
            <Ionicons name="call" size={22} color={Colors.greenReady} />
            <Text style={styles.quickLabel}>Call Host</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.quickBtn} onPress={() => Linking.openURL(`tel:${emergencyPhone}`)}>
          <Ionicons name="medkit" size={22} color={Colors.redUrgent} />
          <Text style={styles.quickLabel}>Emergency</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(guest)/help')}>
          <Ionicons name="chatbubble-ellipses" size={22} color={Colors.primary} />
          <Text style={styles.quickLabel}>AI Concierge</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(guest)/guide')}>
          <Ionicons name="book" size={22} color={Colors.accent} />
          <Text style={styles.quickLabel}>House Guide</Text>
        </TouchableOpacity>
      </View>

      {/* Property Details */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}><Ionicons name="bed" size={18} color={Colors.textSecondary} /><Text style={styles.detailText}>{stay?.property?.bedrooms || 0} Beds</Text></View>
        <View style={styles.detailItem}><Ionicons name="water" size={18} color={Colors.textSecondary} /><Text style={styles.detailText}>{stay?.property?.bathrooms || 0} Baths</Text></View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out" size={16} color={Colors.textSecondary} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  heroImage: { width: '100%', height: 200 },
  welcomeCard: { marginHorizontal: Spacing.md, marginTop: -30, backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  welcomeTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  propName: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  propAddr: { fontSize: 13, color: Colors.textSecondary },
  welcomeMsg: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, marginTop: 8 },
  hostName: { fontSize: 13, fontWeight: '600', color: Colors.accent, fontStyle: 'italic' },
  countdownCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginHorizontal: Spacing.md, marginTop: Spacing.md, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary + '30' },
  countdownLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase' },
  countdownTime: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  countdownHours: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  wifiCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginHorizontal: Spacing.md, marginTop: Spacing.md, backgroundColor: Colors.primary + '08', borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '20' },
  wifiLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase' },
  wifiName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  wifiPass: { fontSize: 13, color: Colors.textSecondary },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.primary + '15' },
  copyText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginHorizontal: Spacing.md, marginTop: Spacing.lg },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, padding: Spacing.md },
  quickBtn: { width: '47%', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  quickLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  detailsRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl, paddingVertical: Spacing.md },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginHorizontal: Spacing.md },
  logoutText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
});
