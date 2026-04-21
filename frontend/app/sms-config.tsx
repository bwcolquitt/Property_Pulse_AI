import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function SmsConfigScreen() {
  const [providers, setProviders] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({ provider: 'disabled', enabled: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [p, c, l] = await Promise.all([api.get('/sms/providers'), api.get('/sms/config'), api.get('/sms/logs?limit=10').catch(() => ({ data: [] }))]);
      setProviders(p.data);
      setConfig(c.data);
      setLogs(l.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/sms/config', config);
      Alert.alert('Saved', 'SMS config updated');
      load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!testPhone) { Alert.alert('Phone', 'Enter a phone number'); return; }
    try {
      const { data } = await api.post('/sms/send', { to: testPhone, body: 'Test message from Property Pulse AI. If you received this, your SMS provider is working!', purpose: 'test' });
      Alert.alert(data.simulated ? 'Simulated' : (data.success ? 'Sent' : 'Failed'), data.message);
      load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Send failed'); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const currentProvider = providers.find(p => p.id === config.provider);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>SMS Delivery</Text>
      <Text style={styles.subtitle}>Send check-in links, checkout reminders, and host messages via SMS.</Text>

      {/* Provider Select */}
      <Text style={styles.section}>SMS Provider</Text>
      {providers.map(p => (
        <TouchableOpacity key={p.id} style={[styles.providerCard, config.provider === p.id && styles.providerActive]} onPress={() => setConfig({ ...config, provider: p.id })}>
          <View style={styles.providerHead}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.providerName, config.provider === p.id && { color: Colors.primary }]}>{p.name}</Text>
              {p.website && <Text style={styles.providerWeb}>{p.website}</Text>}
            </View>
            {config.provider === p.id && <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />}
          </View>
        </TouchableOpacity>
      ))}

      {currentProvider && currentProvider.fields.length > 0 && (
        <>
          <Text style={styles.section}>Credentials</Text>
          {currentProvider.fields.includes('api_key') && (
            <View style={styles.field}>
              <Text style={styles.label}>API Key</Text>
              {config.api_key_masked && !config.api_key ? (
                <View style={styles.maskedRow}><Text style={styles.maskedText}>Saved: {config.api_key_masked}</Text><TouchableOpacity onPress={() => setConfig({ ...config, api_key: '' , api_key_masked: null })}><Text style={styles.replaceText}>Replace</Text></TouchableOpacity></View>
              ) : (
                <TextInput style={styles.input} value={config.api_key || ''} onChangeText={v => setConfig({ ...config, api_key: v })} placeholder="Paste API key" placeholderTextColor={Colors.grayInactive} secureTextEntry />
              )}
            </View>
          )}
          {currentProvider.fields.includes('account_sid') && (
            <View style={styles.field}><Text style={styles.label}>Account SID</Text><TextInput style={styles.input} value={config.account_sid || ''} onChangeText={v => setConfig({ ...config, account_sid: v })} placeholder="ACxxxx..." placeholderTextColor={Colors.grayInactive} /></View>
          )}
          {currentProvider.fields.includes('auth_token') && (
            <View style={styles.field}><Text style={styles.label}>Auth Token</Text>{config.auth_token_masked && !config.auth_token ? (
              <View style={styles.maskedRow}><Text style={styles.maskedText}>Saved: {config.auth_token_masked}</Text><TouchableOpacity onPress={() => setConfig({ ...config, auth_token: '', auth_token_masked: null })}><Text style={styles.replaceText}>Replace</Text></TouchableOpacity></View>
            ) : <TextInput style={styles.input} value={config.auth_token || ''} onChangeText={v => setConfig({ ...config, auth_token: v })} placeholder="Auth token" secureTextEntry placeholderTextColor={Colors.grayInactive} />}</View>
          )}
          {currentProvider.fields.includes('webhook_url') && (
            <View style={styles.field}><Text style={styles.label}>Webhook URL</Text><TextInput style={styles.input} value={config.webhook_url || ''} onChangeText={v => setConfig({ ...config, webhook_url: v })} placeholder="https://your-api.com/send-sms" placeholderTextColor={Colors.grayInactive} /></View>
          )}
          {currentProvider.fields.includes('from_number') && (
            <View style={styles.field}><Text style={styles.label}>From Number</Text><TextInput style={styles.input} value={config.from_number || ''} onChangeText={v => setConfig({ ...config, from_number: v })} placeholder="+15551234567" keyboardType="phone-pad" placeholderTextColor={Colors.grayInactive} /></View>
          )}

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enabled</Text>
            <Switch value={!!config.enabled} onValueChange={v => setConfig({ ...config, enabled: v })} trackColor={{ true: Colors.primary + '80', false: Colors.grayInactive }} thumbColor={config.enabled ? Colors.primary : '#fff'} />
          </View>
        </>
      )}

      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="save" size={16} color="#fff" /><Text style={styles.saveText}>Save Config</Text></>}
      </TouchableOpacity>

      {/* Test Message */}
      {config.enabled && (
        <>
          <Text style={styles.section}>Test Message</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Send test to</Text>
            <TextInput style={styles.input} value={testPhone} onChangeText={setTestPhone} placeholder="+15551234567" keyboardType="phone-pad" placeholderTextColor={Colors.grayInactive} />
          </View>
          <TouchableOpacity style={styles.testBtn} onPress={sendTest}>
            <Ionicons name="send" size={16} color={Colors.primary} />
            <Text style={styles.testText}>Send Test Message</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Recent Logs */}
      {logs.length > 0 && (
        <>
          <Text style={styles.section}>Recent Activity</Text>
          {logs.map(l => (
            <View key={l.id} style={styles.logRow}>
              <View style={[styles.statusDot, { backgroundColor: l.status === 'sent' ? Colors.greenReady : l.status === 'failed' || l.status === 'error' ? Colors.redUrgent : Colors.yellowAtRisk }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.logTo}>{l.to}</Text>
                <Text style={styles.logBody} numberOfLines={1}>{l.body}</Text>
                <Text style={styles.logMeta}>{l.status} · {new Date(l.sent_at).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  section: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, marginTop: 16, textTransform: 'uppercase' },
  providerCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border },
  providerActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '05' },
  providerHead: { flexDirection: 'row', alignItems: 'center' },
  providerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  providerWeb: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  field: { gap: 4, marginTop: 8 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase' },
  input: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  maskedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  maskedText: { fontSize: 13, color: Colors.textSecondary, fontFamily: 'monospace' },
  replaceText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 10, backgroundColor: Colors.primary, marginTop: 12 },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  testBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primary + '08', marginTop: 6 },
  testText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 10, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border, marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  logTo: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  logBody: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  logMeta: { fontSize: 10, color: Colors.grayInactive, marginTop: 2, textTransform: 'uppercase' },
});
