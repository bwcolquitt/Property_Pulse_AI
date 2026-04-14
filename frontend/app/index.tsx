import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import PropertyPulseLogo from '../src/components/PropertyPulseLogo';

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/(tabs)');
    }
  }, [loading, user]);

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
          The operating system for short-term rental readiness. Turnovers, maintenance, inspections, and vendor management — unified.
        </Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {[
          { icon: 'checkmark-circle', title: 'Smart Turnovers', desc: 'Auto-schedule from reservations with AI checklists' },
          { icon: 'construct', title: 'Maintenance HQ', desc: 'Never miss an open issue — top-level visibility' },
          { icon: 'camera', title: 'Photo Proof', desc: 'Before & after documentation with upload' },
          { icon: 'people', title: 'Vendor Marketplace', desc: 'Find, bid, and book cleaners instantly' },
          { icon: 'sparkles', title: 'AI Risk Scoring', desc: 'Predictive readiness powered by GPT-5.2' },
          { icon: 'calendar', title: 'Calendar Views', desc: 'Visual turnover scheduling at a glance' },
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
          onPress={() => router.push('/register')}
        >
          <Text style={styles.primaryBtnText}>Get Started Free</Text>
          <Ionicons name="arrow-forward" size={20} color={Colors.primaryForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="login-btn"
          style={styles.secondaryBtn}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.secondaryBtnText}>Already have an account? Log in</Text>
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
  trust: { alignItems: 'center', paddingTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  goldBar: { width: 30, height: 3, backgroundColor: Colors.accent, borderRadius: 2, marginBottom: Spacing.md },
  trustText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  trustIcons: { flexDirection: 'row', gap: Spacing.lg },
  trustItem: { alignItems: 'center', gap: 4 },
  trustLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
});
