import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';
import { useFeature } from '../src/hooks/useFeature';

export default function HcpConfigScreen() {
  const { hasFeature, showUpgrade, UpgradeModalComponent } = useFeature('hcp');
  const [config, setConfig] = useState<any>({ enabled: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.get('/hcp/config');
      setConfig(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/hcp/config', config);
      Alert.alert('Saved', 'HCP config updated');
      load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  if (!hasFeature) {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, padding: Spacing.lg, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <Ionicons name="lock-closed" size={48} color={Colors.accent} />
          <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' }}>Housecall Pro is an Enterprise feature</Text>
          <Text style={{ fontSize: 14, color: Colors.textSecondary, textAlign: 'center' }}>Upgrade to Enterprise to create HCP estimates & jobs directly from maintenance issues.</Text>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, marginTop: 8 }} onPress={showUpgrade}>
            <Ionicons name="rocket" size={16} color="#fff" /><Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>See Upgrade Options</Text>
          </TouchableOpacity>
        </View>
        {UpgradeModalComponent}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Housecall Pro Integration</Text>
      <Text style={styles.subtitle}>Create estimates and jobs in Housecall Pro directly from maintenance issues.</Text>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={18} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>About HCP Integration</Text>
          <Text style={styles.infoText}>When connected, the maintenance hub adds a "Create HCP Estimate" button to issues. Customer info, description, and line items auto-populate.</Text>
          <Text style={styles.infoLink}>Get your API key at housecallpro.com → Settings → API</Text>
        </View>
      </View>

      <Text style={styles.section}>API Credentials</Text>

      <View style={styles.field}>
        <Text style={styles.label}>HCP API Key</Text>
        {config.api_key_masked && !config.api_key ? (
          <View style={styles.maskedRow}>
            <Text style={styles.maskedText}>{config.api_key_masked}</Text>
            <TouchableOpacity onPress={() => setConfig({ ...config, api_key: '', api_key_masked: null })}>
              <Text style={styles.replaceText}>Replace</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TextInput style={styles.input} value={config.api_key || ''} onChangeText={v => setConfig({ ...config, api_key: v })} placeholder="Paste HCP API key" secureTextEntry placeholderTextColor={Colors.grayInactive} autoCapitalize="none" />
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Default Employee ID (optional)</Text>
        <TextInput style={styles.input} value={config.default_employee_id || ''} onChangeText={v => setConfig({ ...config, default_employee_id: v })} placeholder="Who to auto-assign new jobs to" placeholderTextColor={Colors.grayInactive} autoCapitalize="none" />
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Enabled</Text>
        <Switch value={!!config.enabled} onValueChange={v => setConfig({ ...config, enabled: v })} trackColor={{ true: Colors.primary + '80', false: Colors.grayInactive }} thumbColor={config.enabled ? Colors.primary : '#fff'} />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="save" size={16} color="#fff" /><Text style={styles.saveText}>Save Config</Text></>}
      </TouchableOpacity>

      <View style={styles.noticeBox}>
        <Ionicons name="alert-circle" size={16} color={Colors.yellowAtRisk} />
        <Text style={styles.noticeText}>Until a valid API key is saved, "Create Estimate" actions will be simulated with a SIM-EST-xxxx id so you can preview the workflow.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.md, gap: 8, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.primary + '08', padding: Spacing.md, borderRadius: 10, borderWidth: 1, borderColor: Colors.primary + '25' },
  infoTitle: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  infoText: { fontSize: 12, color: Colors.primary, marginTop: 4, lineHeight: 16 },
  infoLink: { fontSize: 11, color: Colors.primary, fontWeight: '700', marginTop: 6 },
  section: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, marginTop: 14, textTransform: 'uppercase' },
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
  noticeBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: Colors.yellowAtRisk + '10', padding: Spacing.sm, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: Colors.yellowAtRisk + '30' },
  noticeText: { flex: 1, fontSize: 11, color: Colors.yellowAtRisk, lineHeight: 15 },
});
