import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function EmailConfigScreen() {
  const [providers, setProviders] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({ provider: 'disabled', enabled: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [p, c, l] = await Promise.all([api.get('/email/providers'), api.get('/email/config'), api.get('/email/logs?limit=10').catch(() => ({ data: [] }))]);
      setProviders(p.data); setConfig(c.data); setLogs(l.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/email/config', config);
      Alert.alert('Saved', 'Email config updated');
      load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!testEmail) { Alert.alert('Email', 'Enter a test email'); return; }
    try {
      const { data } = await api.post('/email/send', { to: testEmail, subject: 'Property Pulse - Email Test', body: 'If you received this, your email provider is working correctly!' });
      Alert.alert(data.simulated ? 'Simulated' : (data.success ? 'Sent' : 'Failed'), data.message || 'Processed');
      load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Send failed'); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const current = providers.find(p => p.id === config.provider);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Email Delivery</Text>
      <Text style={styles.subtitle}>Send guest access links, booking confirmations, and host notifications by email.</Text>

      <Text style={styles.section}>Email Provider</Text>
      {providers.map(p => (
        <TouchableOpacity key={p.id} style={[styles.providerCard, config.provider === p.id && styles.providerActive]} onPress={() => setConfig({ ...config, provider: p.id })}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.providerName, config.provider === p.id && { color: Colors.primary }]}>{p.name}</Text>
            <Text style={styles.providerDesc}>{p.description}</Text>
            {p.website ? <Text style={styles.providerWeb}>{p.website}</Text> : null}
          </View>
          {config.provider === p.id && <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />}
        </TouchableOpacity>
      ))}

      {current && current.fields.length > 0 && (<>
        <Text style={styles.section}>Credentials</Text>
        {current.fields.includes('smtp_host') && (<View style={styles.field}><Text style={styles.label}>SMTP Host</Text><TextInput style={styles.input} value={config.smtp_host || ''} onChangeText={v => setConfig({ ...config, smtp_host: v })} placeholder="smtp.gmail.com" autoCapitalize="none" placeholderTextColor={Colors.grayInactive} /></View>)}
        {current.fields.includes('smtp_port') && (<View style={styles.field}><Text style={styles.label}>SMTP Port</Text><TextInput style={styles.input} value={String(config.smtp_port || 587)} onChangeText={v => setConfig({ ...config, smtp_port: parseInt(v) || 587 })} placeholder="587" keyboardType="numeric" placeholderTextColor={Colors.grayInactive} /></View>)}
        {current.fields.includes('smtp_user') && (<View style={styles.field}><Text style={styles.label}>SMTP Username</Text><TextInput style={styles.input} value={config.smtp_user || ''} onChangeText={v => setConfig({ ...config, smtp_user: v })} placeholder="you@gmail.com" autoCapitalize="none" placeholderTextColor={Colors.grayInactive} /></View>)}
        {current.fields.includes('smtp_password') && (<View style={styles.field}><Text style={styles.label}>SMTP Password / App Password</Text>{config.smtp_password_masked && !config.smtp_password ? <View style={styles.maskedRow}><Text style={styles.maskedText}>{config.smtp_password_masked}</Text><TouchableOpacity onPress={() => setConfig({ ...config, smtp_password: '', smtp_password_masked: null })}><Text style={styles.replaceText}>Replace</Text></TouchableOpacity></View> : <TextInput style={styles.input} value={config.smtp_password || ''} onChangeText={v => setConfig({ ...config, smtp_password: v })} placeholder="Gmail: use App Password" secureTextEntry placeholderTextColor={Colors.grayInactive} />}</View>)}
        {current.fields.includes('api_key') && (<View style={styles.field}><Text style={styles.label}>API Key</Text>{config.api_key_masked && !config.api_key ? <View style={styles.maskedRow}><Text style={styles.maskedText}>{config.api_key_masked}</Text><TouchableOpacity onPress={() => setConfig({ ...config, api_key: '', api_key_masked: null })}><Text style={styles.replaceText}>Replace</Text></TouchableOpacity></View> : <TextInput style={styles.input} value={config.api_key || ''} onChangeText={v => setConfig({ ...config, api_key: v })} placeholder="Paste API key" secureTextEntry placeholderTextColor={Colors.grayInactive} />}</View>)}
        {current.fields.includes('from_email') && (<View style={styles.field}><Text style={styles.label}>From Email</Text><TextInput style={styles.input} value={config.from_email || ''} onChangeText={v => setConfig({ ...config, from_email: v })} placeholder="host@yourproperty.com" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={Colors.grayInactive} /></View>)}
        {current.fields.includes('from_name') && (<View style={styles.field}><Text style={styles.label}>From Name</Text><TextInput style={styles.input} value={config.from_name || ''} onChangeText={v => setConfig({ ...config, from_name: v })} placeholder="Property Pulse" placeholderTextColor={Colors.grayInactive} /></View>)}

        <View style={styles.toggleRow}><Text style={styles.toggleLabel}>Enabled</Text><Switch value={!!config.enabled} onValueChange={v => setConfig({ ...config, enabled: v })} trackColor={{ true: Colors.primary + '80', false: Colors.grayInactive }} thumbColor={config.enabled ? Colors.primary : '#fff'} /></View>
      </>)}

      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="save" size={16} color="#fff" /><Text style={styles.saveText}>Save Config</Text></>}</TouchableOpacity>

      {config.enabled && (<>
        <Text style={styles.section}>Test Email</Text>
        <View style={styles.field}><Text style={styles.label}>Send test to</Text><TextInput style={styles.input} value={testEmail} onChangeText={setTestEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={Colors.grayInactive} /></View>
        <TouchableOpacity style={styles.testBtn} onPress={sendTest}><Ionicons name="send" size={16} color={Colors.primary} /><Text style={styles.testText}>Send Test Email</Text></TouchableOpacity>
      </>)}

      {logs.length > 0 && (<>
        <Text style={styles.section}>Recent</Text>
        {logs.map(l => (
          <View key={l.id} style={styles.logRow}>
            <View style={[styles.dot, { backgroundColor: l.status === 'sent' ? Colors.greenReady : l.status === 'failed' || l.status === 'error' ? Colors.redUrgent : Colors.yellowAtRisk }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.logTo}>{l.to}</Text>
              <Text style={styles.logSubject} numberOfLines={1}>{l.subject}</Text>
              <Text style={styles.logMeta}>{l.status} · {new Date(l.sent_at).toLocaleString()}</Text>
            </View>
          </View>
        ))}
      </>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.md, gap: 8, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  section: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, marginTop: 14, textTransform: 'uppercase' },
  providerCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border },
  providerActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '05' },
  providerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  providerDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  providerWeb: { fontSize: 11, color: Colors.primary, marginTop: 2 },
  field: { gap: 4, marginTop: 6 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase' },
  input: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  maskedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  maskedText: { fontSize: 13, color: Colors.textSecondary, fontFamily: 'monospace' },
  replaceText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 10, backgroundColor: Colors.primary, marginTop: 10 },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  testBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  testText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 10, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  logTo: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  logSubject: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  logMeta: { fontSize: 10, color: Colors.grayInactive, marginTop: 2, textTransform: 'uppercase' },
});
