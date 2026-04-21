import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function PmsConnectScreen() {
  const [providers, setProviders] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [p, c] = await Promise.all([api.get('/pms/providers'), api.get('/pms/connections')]);
      setProviders(p.data);
      setConnections(c.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const saveConnection = async (provider: string) => {
    try {
      await api.post('/pms/connect', { provider, ...form });
      Alert.alert('Connected', `${provider} linked. Tap Sync to pull reservations.`);
      setActive(null); setForm({}); load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Connect failed'); }
  };

  const syncProvider = async (provider: string) => {
    try {
      const { data } = await api.post(`/pms/sync/${provider}`);
      Alert.alert('Synced', data.message || `${data.synced || 0} reservations imported.`);
      load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Sync failed'); }
  };

  const disconnect = (provider: string) => {
    Alert.alert('Disconnect?', `Remove ${provider} connection?`, [
      { text: 'Cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => { await api.delete(`/pms/connect/${provider}`); load(); } },
    ]);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>PMS Integrations</Text>
      <Text style={styles.subtitle}>Connect your Property Management System to auto-sync reservations.</Text>

      {providers.map(p => {
        const conn = connections.find(c => c.provider === p.id);
        const isExpanded = active === p.id;
        return (
          <View key={p.id} style={[styles.card, conn && styles.cardConnected]}>
            <TouchableOpacity style={styles.cardHead} onPress={() => setActive(isExpanded ? null : p.id)}>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.cardName}>{p.name}</Text>
                  {conn && <View style={styles.connectedBadge}><Ionicons name="checkmark-circle" size={12} color={Colors.greenReady} /><Text style={styles.connectedText}>Connected</Text></View>}
                </View>
                <Text style={styles.cardDesc}>{p.description}</Text>
              </View>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.grayInactive} />
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.expanded}>
                {conn ? (
                  <>
                    {conn.last_sync_at ? (
                      <Text style={styles.lastSync}>Last sync: {new Date(conn.last_sync_at).toLocaleString()} ({conn.last_sync_count || 0} reservations)</Text>
                    ) : (
                      <Text style={styles.lastSync}>Not synced yet.</Text>
                    )}
                    <View style={styles.btnRow}>
                      <TouchableOpacity style={styles.syncBtn} onPress={() => syncProvider(p.id)}>
                        <Ionicons name="sync" size={16} color="#fff" />
                        <Text style={styles.syncText}>Sync Now</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.disconnectBtn} onPress={() => disconnect(p.id)}>
                        <Ionicons name="unlink" size={16} color={Colors.redUrgent} />
                        <Text style={styles.disconnectText}>Disconnect</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    {p.fields.map((f: any) => (
                      <View key={f.key} style={styles.field}>
                        <Text style={styles.label}>{f.label}</Text>
                        <TextInput
                          style={styles.input}
                          value={form[f.key] || ''}
                          onChangeText={v => setForm({ ...form, [f.key]: v })}
                          placeholder={f.label}
                          secureTextEntry={f.type === 'password'}
                          placeholderTextColor={Colors.grayInactive}
                          autoCapitalize="none"
                        />
                      </View>
                    ))}
                    <TouchableOpacity style={styles.connectBtn} onPress={() => saveConnection(p.id)}>
                      <Ionicons name="link" size={16} color="#fff" />
                      <Text style={styles.connectText}>Connect {p.name}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={18} color={Colors.primary} />
        <Text style={styles.infoText}>Current integrations use stubbed syncs — real API connections will pull live reservations from each PMS when proper credentials are configured.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden' },
  cardConnected: { borderColor: Colors.greenReady + '50' },
  cardHead: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  connectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.greenReady + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  connectedText: { fontSize: 10, fontWeight: '700', color: Colors.greenReady, textTransform: 'uppercase' },
  cardDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  expanded: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, gap: 8 },
  field: { gap: 4 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase' },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  connectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary, marginTop: 6 },
  connectText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  lastSync: { fontSize: 12, color: Colors.textSecondary },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  syncBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary },
  syncText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  disconnectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.redUrgent },
  disconnectText: { fontSize: 13, fontWeight: '700', color: Colors.redUrgent },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.primary + '08', padding: Spacing.md, borderRadius: 10, borderWidth: 1, borderColor: Colors.primary + '25', marginTop: 8 },
  infoText: { flex: 1, fontSize: 12, color: Colors.primary, lineHeight: 18 },
});
