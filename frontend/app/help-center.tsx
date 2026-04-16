import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const ROLE_TABS = [
  { key: 'admin', label: 'Admin / Manager', icon: 'shield', color: Colors.primary },
  { key: 'provider', label: 'Service Provider', icon: 'construct', color: Colors.accent },
  { key: 'guest', label: 'Guest', icon: 'person', color: Colors.greenReady },
];

export default function HelpCenterScreen() {
  const router = useRouter();
  const [guides, setGuides] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState('admin');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/guides');
        setGuides(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const currentGuides = guides?.[activeRole] || [];
  const activeTab = ROLE_TABS.find(t => t.key === activeRole)!;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="book" size={28} color={Colors.primary} /></View>
        <Text style={styles.headerTitle}>Help Center</Text>
        <Text style={styles.headerSub}>Easy guides for everyone. Pick your role below.</Text>
      </View>

      {/* AI Chat Banner */}
      <TouchableOpacity style={styles.aiBanner} onPress={() => router.push('/ai-assistant')}>
        <View style={styles.aiBannerIcon}><Ionicons name="chatbubble-ellipses" size={24} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.aiBannerTitle}>Ask AI Assistant</Text>
          <Text style={styles.aiBannerSub}>Get instant answers to any question</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Role Tabs */}
      <View style={styles.tabRow}>
        {ROLE_TABS.map(tab => (
          <TouchableOpacity key={tab.key} style={[styles.tab, activeRole === tab.key && { backgroundColor: tab.color, borderColor: tab.color }]} onPress={() => { setActiveRole(tab.key); setExpanded(null); }}>
            <Ionicons name={tab.icon as any} size={16} color={activeRole === tab.key ? '#fff' : tab.color} />
            <Text style={[styles.tabText, activeRole === tab.key && { color: '#fff' }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Guide Cards */}
      {currentGuides.map((guide: any, i: number) => {
        const isExpanded = expanded === guide.id;
        return (
          <View key={guide.id}>
            <TouchableOpacity style={[styles.guideCard, isExpanded && { borderColor: guide.color }]} onPress={() => setExpanded(isExpanded ? null : guide.id)}>
              <View style={[styles.guideIcon, { backgroundColor: guide.color + '15' }]}>
                <Ionicons name={(guide.icon || 'document') as any} size={22} color={guide.color} />
              </View>
              <View style={styles.guideInfo}>
                <Text style={styles.guideTitle}>{guide.title}</Text>
                <Text style={styles.guideSummary}>{guide.summary}</Text>
              </View>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.grayInactive} />
            </TouchableOpacity>

            {isExpanded && (
              <View style={[styles.guideContent, { borderLeftColor: guide.color }]}>
                {/* Steps as infographic */}
                <View style={styles.stepsSection}>
                  <View style={styles.stepsHeader}>
                    <Ionicons name="footsteps" size={16} color={guide.color} />
                    <Text style={[styles.stepsTitle, { color: guide.color }]}>Step by Step</Text>
                  </View>
                  {(guide.steps || []).map((step: string, j: number) => (
                    <View key={j} style={styles.stepRow}>
                      <View style={[styles.stepNum, { backgroundColor: guide.color }]}>
                        <Text style={styles.stepNumText}>{j + 1}</Text>
                      </View>
                      <View style={styles.stepLine}>
                        {j < (guide.steps?.length || 0) - 1 && <View style={[styles.stepConnector, { backgroundColor: guide.color + '30' }]} />}
                      </View>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>

                {/* Tips */}
                {(guide.tips || []).length > 0 && (
                  <View style={styles.tipBox}>
                    <Ionicons name="bulb" size={18} color={Colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tipLabel}>Pro Tip</Text>
                      {guide.tips.map((tip: string, j: number) => (
                        <Text key={j} style={styles.tipText}>{tip}</Text>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Can't find what you need?</Text>
        <TouchableOpacity style={styles.footerBtn} onPress={() => router.push('/ai-assistant')}>
          <Ionicons name="chatbubble-ellipses" size={18} color={Colors.primary} />
          <Text style={styles.footerBtnText}>Chat with AI Assistant</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  header: { alignItems: 'center', paddingVertical: Spacing.lg, gap: 6 },
  headerIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  aiBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.primary, borderRadius: 14, padding: Spacing.md },
  aiBannerIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  aiBannerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  aiBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  tabRow: { flexDirection: 'row', gap: Spacing.sm },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surfaceSecondary, borderWidth: 1.5, borderColor: Colors.border },
  tabText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  guideCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border },
  guideIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  guideInfo: { flex: 1, gap: 2 },
  guideTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  guideSummary: { fontSize: 12, color: Colors.textSecondary },
  guideContent: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderLeftWidth: 4, marginTop: -6, gap: Spacing.md },
  stepsSection: { gap: 2 },
  stepsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  stepsTitle: { fontSize: 14, fontWeight: '700' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 36 },
  stepNum: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  stepNumText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  stepLine: { width: 26, position: 'absolute', left: 0, top: 28, bottom: 0, alignItems: 'center' },
  stepConnector: { width: 2, flex: 1 },
  stepText: { flex: 1, fontSize: 14, color: Colors.textPrimary, lineHeight: 20, paddingBottom: 10 },
  tipBox: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.accent + '10', borderRadius: 10, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.accent + '25' },
  tipLabel: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  tipText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  footer: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  footerText: { fontSize: 14, color: Colors.textSecondary },
  footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  footerBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
