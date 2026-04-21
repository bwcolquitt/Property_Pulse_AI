import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [devCode, setDevCode] = useState('');

  const sendOtp = async () => {
    if (!phone.match(/^\+?\d{7,}$/)) { Alert.alert('Invalid', 'Enter a valid phone number'); return; }
    setSending(true);
    try {
      const { data } = await api.post('/guest-otp/send', { phone });
      if (data.simulated && data.code) {
        setDevCode(data.code);
        Alert.alert('Dev Mode', `SMS not configured. Code is ${data.code}. This message only appears when SMS is disabled.`);
      } else {
        Alert.alert('Code Sent', data.message);
      }
      setStep('code');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to send code');
    } finally { setSending(false); }
  };

  const verify = async () => {
    if (code.length !== 6) { Alert.alert('Invalid', 'Code must be 6 digits'); return; }
    setVerifying(true);
    try {
      await api.post('/guest-otp/verify', { phone, code });
      Alert.alert('Verified', 'Your phone has been verified. Welcome!', [{ text: 'Continue', onPress: () => router.replace('/(guest)/welcome') }]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Invalid code');
    } finally { setVerifying(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={56} color={Colors.primary} />
          <Text style={styles.title}>Verify Your Phone</Text>
          <Text style={styles.subtitle}>{step === 'phone' ? 'We\'ll text you a 6-digit code to confirm it\'s really you.' : `Enter the code we sent to ${phone}`}</Text>
        </View>

        {step === 'phone' ? (
          <>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+15551234567" keyboardType="phone-pad" placeholderTextColor={Colors.grayInactive} autoFocus />
            <TouchableOpacity style={styles.btn} onPress={sendOtp} disabled={sending}>
              {sending ? <ActivityIndicator color="#fff" /> : <><Ionicons name="send" size={16} color="#fff" /><Text style={styles.btnText}>Send Code</Text></>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput style={[styles.input, styles.codeInput]} value={code} onChangeText={setCode} placeholder="000000" keyboardType="number-pad" maxLength={6} placeholderTextColor={Colors.grayInactive} autoFocus />
            {devCode ? <Text style={styles.devHint}>Dev: {devCode}</Text> : null}
            <TouchableOpacity style={styles.btn} onPress={verify} disabled={verifying}>
              {verifying ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.btnText}>Verify</Text></>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('phone')}><Text style={styles.secondary}>Use a different number</Text></TouchableOpacity>
            <TouchableOpacity onPress={sendOtp}><Text style={styles.secondary}>Resend code</Text></TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/(guest)/welcome')}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: Spacing.lg, justifyContent: 'center', gap: Spacing.sm },
  header: { alignItems: 'center', gap: 8, marginBottom: Spacing.lg },
  title: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '800', color: Colors.textPrimary, textTransform: 'uppercase' },
  input: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, fontSize: 18, borderWidth: 1.5, borderColor: Colors.border, color: Colors.textPrimary },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: 24, fontWeight: '800' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 10, backgroundColor: Colors.primary, marginTop: 8 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  secondary: { fontSize: 13, color: Colors.primary, textAlign: 'center', fontWeight: '600', paddingVertical: 8 },
  devHint: { fontSize: 11, color: Colors.yellowAtRisk, textAlign: 'center', fontStyle: 'italic' },
  skipBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 20 },
  skipText: { fontSize: 13, color: Colors.textSecondary },
});
