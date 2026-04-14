import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';

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
        <View style={styles.waveBg}>
          <Ionicons name="sunny" size={48} color={Colors.accent} />
        </View>
        <Text style={styles.brand}>PropertyPulse</Text>
        <Text style={styles.heroTitle}>Get every property{'\n'}guest-ready on time</Text>
        <Text style={styles.heroSubtitle}>
          The all-in-one platform for short-term rental turnovers, maintenance, inspections, and vendor management.
        </Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {[
          { icon: 'checkmark-circle', title: 'Smart Turnovers', desc: 'Auto-schedule from reservations' },
          { icon: 'construct', title: 'Maintenance HQ', desc: 'Never miss an open issue' },
          { icon: 'camera', title: 'Photo Proof', desc: 'Before & after documentation' },
          { icon: 'people', title: 'Vendor Marketplace', desc: 'Find & book cleaners instantly' },
        ].map((f, i) => (
          <View key={i} style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: i % 2 === 0 ? Colors.secondary + '30' : Colors.accent + '30' }]}>
              <Ionicons name={f.icon as any} size={24} color={i % 2 === 0 ? Colors.primary : Colors.accent} />
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
  hero: { alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.lg },
  waveBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accent + '20', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  brand: { fontSize: 18, fontWeight: '700', color: Colors.primary, letterSpacing: 1, marginBottom: Spacing.sm },
  heroTitle: { fontSize: 32, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', lineHeight: 40, letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md, lineHeight: 24, paddingHorizontal: Spacing.md },
  features: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, gap: Spacing.md },
  featureCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  featureIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  featureTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  featureDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  cta: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, gap: Spacing.md },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  primaryBtnText: { color: Colors.primaryForeground, fontSize: 17, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  secondaryBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  trust: { alignItems: 'center', paddingTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  trustText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  trustIcons: { flexDirection: 'row', gap: Spacing.lg },
  trustItem: { alignItems: 'center', gap: 4 },
  trustLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
});
