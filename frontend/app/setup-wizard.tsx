import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function SetupWizardScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await api.get('/setup/status');
      setStatus(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading || !status) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero */}
      <View style={styles.hero}>
        <Ionicons name="rocket" size={36} color="#fff" />
        <Text style={styles.heroTitle}>Setup Wizard</Text>
        <Text style={styles.heroSub}>Get your Property Pulse white-label account ready for guests in minutes.</Text>
        <View style={styles.progressOuter}>
          <View style={[styles.progressInner, { width: `${status.progress_pct}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{status.required_done} of {status.required_total} required steps · {status.progress_pct}%</Text>
      </View>

      {status.setup_complete && (
        <View style={styles.doneCard}>
          <Ionicons name="checkmark-circle" size={22} color={Colors.greenReady} />
          <Text style={styles.doneText}>Required setup is complete! You can still configure optional items below.</Text>
        </View>
      )}

      {/* Steps */}
      {status.steps.map((step: any, i: number) => (
        <View key={step.id} style={[styles.stepCard, step.complete && styles.stepComplete]}>
          <View style={styles.stepHead}>
            <View style={[styles.stepCircle, step.complete && { backgroundColor: Colors.greenReady, borderColor: Colors.greenReady }]}>
              {step.complete ? <Ionicons name="checkmark" size={18} color="#fff" /> : <Text style={styles.stepNum}>{i + 1}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                {step.optional && <View style={styles.optionalBadge}><Text style={styles.optionalText}>OPTIONAL</Text></View>}
                {typeof step.count === 'number' && step.count > 0 && <View style={styles.countBadge}><Text style={styles.countText}>{step.count}</Text></View>}
              </View>
              <Text style={styles.stepDesc}>{step.description}</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.stepBtn, step.complete && styles.stepBtnDone]} onPress={() => router.push(step.route)}>
            <Ionicons name={step.complete ? 'checkmark-circle-outline' : 'arrow-forward'} size={16} color={step.complete ? Colors.greenReady : '#fff'} />
            <Text style={[styles.stepBtnText, step.complete && { color: Colors.greenReady }]}>{step.complete ? 'Review' : step.action_label}</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.refreshBtn} onPress={load}>
        <Ionicons name="refresh" size={16} color={Colors.primary} />
        <Text style={styles.refreshText}>Refresh Status</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  hero: { backgroundColor: Colors.primary, borderRadius: 16, padding: Spacing.lg, gap: 8 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  heroSub: { fontSize: 13, color: '#ffffffD0', lineHeight: 18 },
  progressOuter: { height: 8, backgroundColor: '#ffffff30', borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  progressInner: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  progressLabel: { fontSize: 11, color: '#ffffffC0', fontWeight: '700', textTransform: 'uppercase' },
  doneCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.greenReady + '10', padding: Spacing.md, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.greenReady },
  doneText: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.greenReady },
  stepCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border, gap: 10 },
  stepComplete: { borderColor: Colors.greenReady + '40', backgroundColor: Colors.greenReady + '05' },
  stepHead: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  stepNum: { fontSize: 14, fontWeight: '800', color: Colors.textSecondary },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  stepTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  stepDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 3, lineHeight: 16 },
  optionalBadge: { backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  optionalText: { fontSize: 9, fontWeight: '800', color: Colors.textSecondary },
  countBadge: { backgroundColor: Colors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  countText: { fontSize: 10, fontWeight: '800', color: Colors.primary },
  stepBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.primary },
  stepBtnDone: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.greenReady },
  stepBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary, marginTop: 8 },
  refreshText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
