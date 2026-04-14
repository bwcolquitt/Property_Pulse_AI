import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', role: 'property_manager', company_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const roles = [
    { value: 'property_manager', label: 'Host / Manager', icon: 'business' },
    { value: 'cleaner', label: 'Cleaner', icon: 'sparkles' },
    { value: 'maintenance_technician', label: 'Maintenance Vendor', icon: 'construct' },
  ];

  const handleRegister = async () => {
    if (!form.first_name || !form.email || !form.password) { setError('Please fill in required fields'); return; }
    setLoading(true);
    setError('');
    try {
      await register(form);
      router.replace('/(tabs)');
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity testID="register-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Join PropertyPulse today</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={Colors.redUrgent} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>I am a...</Text>
        <View style={styles.roleRow}>
          {roles.map(r => (
            <TouchableOpacity key={r.value} testID={`role-${r.value}`} style={[styles.roleBtn, form.role === r.value && styles.roleBtnActive]} onPress={() => setForm({ ...form, role: r.value })}>
              <Ionicons name={r.icon as any} size={20} color={form.role === r.value ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.roleBtnText, form.role === r.value && styles.roleBtnTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput testID="register-first-name" style={styles.input} placeholder="First" placeholderTextColor={Colors.grayInactive} value={form.first_name} onChangeText={v => setForm({ ...form, first_name: v })} />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput testID="register-last-name" style={styles.input} placeholder="Last" placeholderTextColor={Colors.grayInactive} value={form.last_name} onChangeText={v => setForm({ ...form, last_name: v })} />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email *</Text>
          <TextInput testID="register-email" style={styles.input} placeholder="you@example.com" placeholderTextColor={Colors.grayInactive} value={form.email} onChangeText={v => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password *</Text>
          <TextInput testID="register-password" style={styles.input} placeholder="Min 6 characters" placeholderTextColor={Colors.grayInactive} value={form.password} onChangeText={v => setForm({ ...form, password: v })} secureTextEntry />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Company Name</Text>
          <TextInput testID="register-company" style={styles.input} placeholder="Optional" placeholderTextColor={Colors.grayInactive} value={form.company_name} onChangeText={v => setForm({ ...form, company_name: v })} />
        </View>

        <TouchableOpacity testID="register-submit-btn" style={styles.submitBtn} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.primaryForeground} /> : <Text style={styles.submitText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity testID="register-login-link" style={styles.linkBtn} onPress={() => router.push('/login')}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Log in</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 40, gap: Spacing.md },
  backBtn: { width: 44, height: 44, justifyContent: 'center', marginTop: Spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: Spacing.sm },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.redUrgent + '15', padding: Spacing.md, borderRadius: 8 },
  errorText: { color: Colors.redUrgent, fontSize: 14, flex: 1 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  roleBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  roleBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  roleBtnTextActive: { color: Colors.primary },
  row: { flexDirection: 'row', gap: Spacing.md },
  inputGroup: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: Spacing.md, height: 48, fontSize: 16, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.sm },
  submitText: { color: Colors.primaryForeground, fontSize: 17, fontWeight: '700' },
  linkBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  linkText: { fontSize: 15, color: Colors.textSecondary },
  linkBold: { color: Colors.primary, fontWeight: '700' },
});
