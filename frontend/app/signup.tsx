import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';
import { useAuth } from '../src/context/AuthContext';

export default function SignupScreen() {
  const router = useRouter();
  const { refreshAuth } = useAuth() as any;
  const [plans, setPlans] = useState<any[]>([]);
  const [form, setForm] = useState({ company_name: '', first_name: '', last_name: '', email: '', password: '', phone: '', plan: 'pro' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { api.get('/tenants/plans').then(r => setPlans(r.data)); }, []);

  const submit = async () => {
    if (!form.company_name || !form.email || !form.password || !form.first_name) { Alert.alert('Required', 'Please fill in all required fields'); return; }
    if (form.password.length < 8) { Alert.alert('Password', 'Must be at least 8 characters'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post('/tenants/signup', form);
      Alert.alert('Welcome!', `Your 14-day free trial has started. Trial ends ${new Date(data.trial_ends_at).toLocaleDateString()}`, [
        { text: 'Continue', onPress: async () => { if (refreshAuth) await refreshAuth(); router.replace('/(tabs)/admin'); } },
      ]);
    } catch (e: any) {
      Alert.alert('Sign Up Failed', e.response?.data?.detail || 'Try a different email');
    } finally { setSubmitting(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="rocket" size={40} color={Colors.primary} />
          <Text style={styles.title}>Start Your Free Trial</Text>
          <Text style={styles.sub}>14 days free. No charge until day 15. Cancel anytime.</Text>
        </View>

        <Text style={styles.section}>Choose a plan</Text>
        <View style={styles.planRow}>
          {plans.map(p => (
            <TouchableOpacity key={p.id} style={[styles.planCard, form.plan === p.id && styles.planActive, p.id === 'pro' && styles.planPopular]} onPress={() => setForm({ ...form, plan: p.id })}>
              {p.id === 'pro' && <View style={styles.popBadge}><Text style={styles.popText}>MOST POPULAR</Text></View>}
              <Text style={[styles.planName, form.plan === p.id && { color: Colors.primary }]}>{p.name}</Text>
              <View style={styles.priceRow}><Text style={styles.priceDollar}>${p.price}</Text><Text style={styles.priceMo}>/mo</Text></View>
              <Text style={styles.planCap}>{p.properties_cap === -1 ? 'Unlimited properties' : `Up to ${p.properties_cap} properties`}</Text>
              <Text style={styles.planCap}>{p.users_cap === -1 ? 'Unlimited users' : `${p.users_cap} team members`}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>Your Details</Text>
        <Text style={styles.label}>Company Name *</Text>
        <TextInput style={styles.input} value={form.company_name} onChangeText={v => setForm({ ...form, company_name: v })} placeholder="Acme Rentals LLC" placeholderTextColor={Colors.grayInactive} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Text style={styles.label}>First Name *</Text><TextInput style={styles.input} value={form.first_name} onChangeText={v => setForm({ ...form, first_name: v })} placeholder="Jane" placeholderTextColor={Colors.grayInactive} /></View>
          <View style={{ flex: 1 }}><Text style={styles.label}>Last Name</Text><TextInput style={styles.input} value={form.last_name} onChangeText={v => setForm({ ...form, last_name: v })} placeholder="Doe" placeholderTextColor={Colors.grayInactive} /></View>
        </View>
        <Text style={styles.label}>Email *</Text>
        <TextInput style={styles.input} value={form.email} onChangeText={v => setForm({ ...form, email: v })} placeholder="jane@acmerentals.com" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={Colors.grayInactive} />
        <Text style={styles.label}>Password * (min 8 chars)</Text>
        <TextInput style={styles.input} value={form.password} onChangeText={v => setForm({ ...form, password: v })} placeholder="••••••••" secureTextEntry placeholderTextColor={Colors.grayInactive} />
        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput style={styles.input} value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} placeholder="+15551234567" keyboardType="phone-pad" placeholderTextColor={Colors.grayInactive} />

        <View style={styles.stripePlaceholder}>
          <Ionicons name="card" size={16} color={Colors.primary} />
          <Text style={styles.stripeText}>Card on file required. We'll add Stripe card collection once your Stripe account is connected. <Text style={styles.stripeBold}>No charge for 14 days.</Text></Text>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <><Ionicons name="rocket" size={16} color="#fff" /><Text style={styles.submitText}>Start Free Trial</Text></>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/login')}><Text style={styles.loginLink}>Already have an account? Log in</Text></TouchableOpacity>
        <Text style={styles.terms}>By signing up you agree to our Terms of Service and Privacy Policy.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.sm },
  header: { alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary },
  sub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  section: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, marginTop: 14, textTransform: 'uppercase' },
  planRow: { flexDirection: 'row', gap: 8 },
  planCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: Colors.border, position: 'relative', gap: 2 },
  planActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '05' },
  planPopular: { borderColor: Colors.accent, borderWidth: 2 },
  popBadge: { position: 'absolute', top: -10, alignSelf: 'center', backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  popText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  planName: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, marginTop: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
  priceDollar: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary },
  priceMo: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4, marginLeft: 2 },
  planCap: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, marginTop: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  stripePlaceholder: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.primary + '08', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.primary + '25', marginTop: 8 },
  stripeText: { flex: 1, fontSize: 11, color: Colors.primary, lineHeight: 15 },
  stripeBold: { fontWeight: '800' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 10, backgroundColor: Colors.primary, marginTop: 12 },
  submitText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  loginLink: { fontSize: 13, fontWeight: '700', color: Colors.primary, textAlign: 'center', paddingVertical: 10 },
  terms: { fontSize: 10, color: Colors.grayInactive, textAlign: 'center' },
});
