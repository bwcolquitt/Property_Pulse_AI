import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import PropertyPulseLogo from '../src/components/PropertyPulseLogo';

const DEMO_ROLES = [
  { key: 'property_manager', label: 'Host / Manager', icon: 'shield', desc: 'See the full admin dashboard, properties, turnovers, reports, and AI tools', color: Colors.primary },
  { key: 'cleaner', label: 'Cleaner', icon: 'sparkles', desc: 'Complete checklists, take photos, report issues, and scan QR codes', color: Colors.secondary },
  { key: 'maintenance', label: 'Maintenance Tech', icon: 'construct', desc: 'View assigned repairs, update status, and bid on jobs', color: Colors.accent },
  { key: 'vendor', label: 'Vendor', icon: 'briefcase', desc: 'Browse the job board, submit bids, and manage your schedule', color: Colors.purpleAwaiting },
];

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading, loginDemo } = useAuth();
  const [demoModal, setDemoModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);

  const startDemo = async () => {
    if (!leadName.trim() || !leadEmail.trim()) {
      Alert.alert('Required', 'Please enter your name and email to try the demo');
      return;
    }
    if (!selectedRole) return;
    setDemoLoading(true);
    try {
      await loginDemo(leadName.trim(), leadEmail.trim().toLowerCase(), selectedRole);
      setDemoModal(false);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Could not start demo');
    } finally {
      setDemoLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      {/* Hero Section */}
      <View style={styles.hero}>
        <PropertyPulseLogo size={56} showTagline={false} />
        <View style={styles.divider} />
        <Text style={styles.heroTitle}>Get every property{'\n'}guest-ready on time</Text>
        <Text style={styles.heroSubtitle}>
          The AI-powered operating system for short-term rental readiness. Smarter turnovers, maintenance, inspections, and vendor coordination in one place.
        </Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {[
          { icon: 'checkmark-circle', title: 'AI Smart Turnovers', desc: 'Auto-schedule from reservations with AI-optimized checklists' },
          { icon: 'construct', title: 'AI Maintenance HQ', desc: 'AI detects patterns and predicts issues before they happen' },
          { icon: 'camera', title: 'Photo Proof', desc: 'Before & after documentation with AI-verified uploads' },
          { icon: 'people', title: 'AI Vendor Matching', desc: 'Smart matching, bidding, and scheduling with AI coordination' },
          { icon: 'sparkles', title: 'AI Risk Scoring', desc: 'Predictive readiness scoring powered by GPT-5.2' },
          { icon: 'analytics', title: 'AI Insights', desc: 'Automated reporting, cost forecasting, and trend analysis' },
        ].map((f, i) => (
          <View key={i} style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: i % 2 === 0 ? Colors.secondary + '25' : Colors.accent + '20' }]}>
              <Ionicons name={f.icon as any} size={22} color={i % 2 === 0 ? Colors.primary : Colors.accent} />
            </View>
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureDesc}>{f.desc}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View style={styles.cta}>
        <TouchableOpacity
          testID="get-started-btn"
          style={styles.primaryBtn}
          onPress={() => router.push('/signup')}
        >
          <Text style={styles.primaryBtnText}>Start 14-Day Free Trial</Text>
          <Ionicons name="arrow-forward" size={20} color={Colors.primaryForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="login-btn"
          style={styles.secondaryBtn}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.secondaryBtnText}>Already have an account? Log in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="guest-book-btn"
          style={styles.guestBtn}
          onPress={() => router.push('/guest-book')}
        >
          <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
          <Text style={styles.guestBtnText}>Book a Stay as Guest</Text>
        </TouchableOpacity>
      </View>

      {/* Trust */}
      <View style={styles.trust}>
        <View style={styles.goldBar} />
        <Text style={styles.trustText}>Trusted by 500+ property managers across California</Text>
        <View style={styles.trustIcons}>
          {['star', 'shield-checkmark', 'time'].map((icon, i) => (
            <View key={i} style={styles.trustItem}>
              <Ionicons name={icon as any} size={20} color={Colors.primary} />
              <Text style={styles.trustLabel}>
                {['4.9 Rating', 'Secure', '24/7 Support'][i]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Interactive Demo Section */}
      <View style={styles.demoSection}>
        <View style={styles.demoHeader}>
          <Ionicons name="play-circle" size={24} color={Colors.accent} />
          <Text style={styles.demoTitle}>Try the Live Demo</Text>
        </View>
        <Text style={styles.demoSubtitle}>See how Property Pulse AI works for your role. 1-hour free access, no credit card needed.</Text>
        <View style={styles.demoGrid}>
          {DEMO_ROLES.map(role => (
            <TouchableOpacity key={role.key} style={styles.demoCard} onPress={() => { setSelectedRole(role.key); setDemoModal(true); }}>
              <View style={[styles.demoCardIcon, { backgroundColor: role.color + '15' }]}>
                <Ionicons name={role.icon as any} size={22} color={role.color} />
              </View>
              <Text style={styles.demoCardLabel}>{role.label}</Text>
              <Text style={styles.demoCardDesc}>{role.desc}</Text>
              <View style={[styles.demoCardBtn, { backgroundColor: role.color }]}>
                <Ionicons name="play" size={12} color="#fff" />
                <Text style={styles.demoCardBtnText}>Try Demo</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Demo Lead Capture Modal */}
      <Modal visible={demoModal} transparent animationType="fade" onRequestClose={() => setDemoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Ionicons name="play-circle" size={28} color={Colors.accent} />
              <Text style={styles.modalTitle}>Start Your Demo</Text>
            </View>
            <Text style={styles.modalSub}>
              Enter your info to get 1-hour free access as a{' '}
              <Text style={{ fontWeight: '700', color: DEMO_ROLES.find(r => r.key === selectedRole)?.color }}>
                {DEMO_ROLES.find(r => r.key === selectedRole)?.label}
              </Text>
            </Text>
            <TextInput style={styles.modalInput} value={leadName} onChangeText={setLeadName} placeholder="Your name" placeholderTextColor={Colors.grayInactive} autoCapitalize="words" />
            <TextInput style={styles.modalInput} value={leadEmail} onChangeText={setLeadEmail} placeholder="Your email" placeholderTextColor={Colors.grayInactive} autoCapitalize="none" keyboardType="email-address" />
            <View style={styles.modalTimeBadge}>
              <Ionicons name="time" size={14} color={Colors.accent} />
              <Text style={styles.modalTimeText}>1-hour access · No credit card · Full features</Text>
            </View>
            <TouchableOpacity style={styles.modalStartBtn} onPress={startDemo} disabled={demoLoading}>
              {demoLoading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="rocket" size={18} color="#fff" /><Text style={styles.modalStartText}>Launch Demo</Text></>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDemoModal(false)}>
              <Text style={styles.modalCancelText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  hero: { alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 40, paddingBottom: Spacing.lg },
  divider: { width: 40, height: 3, backgroundColor: Colors.accent, borderRadius: 2, marginVertical: Spacing.lg },
  heroTitle: { fontSize: 30, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', lineHeight: 38, letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md, lineHeight: 23, paddingHorizontal: Spacing.md },
  features: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, gap: Spacing.sm },
  featureCard: { width: '48%', backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  featureIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  featureTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  featureDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  cta: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, gap: Spacing.md },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  primaryBtnText: { color: Colors.primaryForeground, fontSize: 17, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  secondaryBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  guestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.accent, backgroundColor: Colors.accent + '08' },
  guestBtnText: { fontSize: 14, fontWeight: '700', color: Colors.accent },
  trust: { alignItems: 'center', paddingTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  goldBar: { width: 30, height: 3, backgroundColor: Colors.accent, borderRadius: 2, marginBottom: Spacing.md },
  trustText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  trustIcons: { flexDirection: 'row', gap: Spacing.lg },
  trustItem: { alignItems: 'center', gap: 4 },
  trustLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  // Demo Section
  demoSection: { marginTop: Spacing.xl, paddingHorizontal: Spacing.md, paddingBottom: 20 },
  demoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  demoTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  demoSubtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: Spacing.md },
  demoGrid: { gap: Spacing.sm },
  demoCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  demoCardIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  demoCardLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  demoCardDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  demoCardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, marginTop: 4 },
  demoCardBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  // Demo Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: Spacing.lg },
  modal: { backgroundColor: Colors.surface, borderRadius: 18, padding: Spacing.lg, gap: Spacing.sm },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  modalTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  modalSub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  modalInput: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  modalTimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent + '10', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.accent + '25' },
  modalTimeText: { fontSize: 12, fontWeight: '600', color: Colors.accent },
  modalStartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, marginTop: Spacing.sm },
  modalStartText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
});
