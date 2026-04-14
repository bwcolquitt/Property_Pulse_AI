import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity testID="login-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="home" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to Property Pulse</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={Colors.redUrgent} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
              <TextInput
                testID="login-email-input"
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.grayInactive}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
              <TextInput
                testID="login-password-input"
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor={Colors.grayInactive}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity testID="login-submit-btn" style={styles.submitBtn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color={Colors.primaryForeground} /> : <Text style={styles.submitText}>Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity testID="login-register-link" style={styles.linkBtn} onPress={() => router.push('/register')}>
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Sign Up</Text></Text>
          </TouchableOpacity>
        </View>

        {/* Quick demo login */}
        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>Quick Demo Access</Text>
          {[
            { label: 'Manager', email: 'admin@example.com', pw: 'admin123' },
            { label: 'Cleaner', email: 'maria@example.com', pw: 'cleaner123' },
            { label: 'Vendor', email: 'bob@fixitpro.com', pw: 'vendor123' },
          ].map((d, i) => (
            <TouchableOpacity
              key={i}
              testID={`demo-login-${d.label.toLowerCase()}`}
              style={styles.demoBtn}
              onPress={() => { setEmail(d.email); setPassword(d.pw); }}
            >
              <Ionicons name="person-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.demoBtnText}>{d.label}</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', marginTop: Spacing.sm },
  header: { alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.xl },
  iconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accent + '20', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.redUrgent + '15', padding: Spacing.md, borderRadius: 8, marginBottom: Spacing.md },
  errorText: { color: Colors.redUrgent, fontSize: 14, flex: 1 },
  form: { gap: Spacing.md },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: Spacing.md, height: 50, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  input: { flex: 1, fontSize: 16, color: Colors.textPrimary },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.sm },
  submitText: { color: Colors.primaryForeground, fontSize: 17, fontWeight: '700' },
  linkBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  linkText: { fontSize: 15, color: Colors.textSecondary },
  linkBold: { color: Colors.primary, fontWeight: '700' },
  demoSection: { marginTop: Spacing.xl, padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  demoTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.sm, textAlign: 'center' },
  demoBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  demoBtnText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
});
