import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function InspectionPrepScreen() {
  const [checklist, setChecklist] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedProp, setSelectedProp] = useState('');
  const [recommendations, setRecs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(false);

  useEffect(() => {
    api.get('/properties').then(r => { setProperties(r.data); if (r.data.length) setSelectedProp(r.data[0].id); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedProp) {
      api.get(`/inspection-prep/checklist/${selectedProp}`).then(r => setChecklist(r.data)).catch(() => {});
    }
  }, [selectedProp]);

  const toggleItem = (idx: number) => {
    if (!checklist?.items) return;
    const items = [...checklist.items];
    items[idx] = { ...items[idx], checked: !items[idx].checked, last_checked: new Date().toISOString() };
    setChecklist({ ...checklist, items });
  };

  const save = async () => {
    if (!checklist?.items) return;
    try {
      await api.put(`/inspection-prep/checklist/${selectedProp}`, { items: checklist.items });
      Alert.alert('Saved', 'Inspection checklist updated');
    } catch { Alert.alert('Error', 'Failed to save'); }
  };

  const getAIRecs = async () => {
    setLoadingRecs(true);
    try {
      const { data } = await api.post(`/inspection-prep/ai-recommendations/${selectedProp}`);
      setRecs(data);
    } catch { Alert.alert('Error', 'Failed to get AI recommendations'); }
    finally { setLoadingRecs(false); }
  };

  const categories = checklist?.items ? [...new Set(checklist.items.map((i: any) => i.category))] as string[] : [];
  const CAT_COLORS: Record<string, string> = { 'Fire Safety': Colors.redUrgent, 'Electrical': Colors.accent, 'Structural': Colors.blueAssigned, 'Pool/Spa': Colors.secondary, 'General Safety': Colors.greenReady, 'Permits': Colors.purpleAwaiting };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={24} color={Colors.primary} />
        <Text style={styles.title}>City Inspection Prep</Text>
        <Text style={styles.subtitle}>AI-powered compliance checklist for rental inspections</Text>
      </View>

      <Text style={styles.label}>Property</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.chipRow}>
        {properties.map(p => (<TouchableOpacity key={p.id} style={[styles.chip, selectedProp === p.id && styles.chipActive]} onPress={() => setSelectedProp(p.id)}><Text style={[styles.chipText, selectedProp === p.id && { color: '#fff' }]}>{p.nickname || p.name}</Text></TouchableOpacity>))}
      </View></ScrollView>

      {/* AI Recommendations Button */}
      <TouchableOpacity style={styles.aiBtn} onPress={getAIRecs} disabled={loadingRecs}>
        {loadingRecs ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
        <Text style={styles.aiBtnText}>AI Inspection Analysis</Text>
      </TouchableOpacity>

      {/* AI Recommendations */}
      {recommendations && (
        <View style={styles.recsBox}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Compliance Score</Text>
            <Text style={[styles.scoreNum, { color: recommendations.compliance_score >= 80 ? Colors.greenReady : recommendations.compliance_score >= 50 ? Colors.yellowAtRisk : Colors.redUrgent }]}>{recommendations.compliance_score}%</Text>
          </View>
          {recommendations.recommendations.map((rec: any, i: number) => (
            <View key={i} style={[styles.recCard, rec.type === 'priority' && { borderColor: Colors.redUrgent }]}>
              <Ionicons name={rec.type === 'priority' ? 'alert-circle' : rec.type === 'overdue' ? 'time' : 'checkbox-outline'} size={16} color={rec.type === 'priority' ? Colors.redUrgent : Colors.yellowAtRisk} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recItem}>{rec.item}</Text>
                <Text style={styles.recText}>{rec.recommendation}</Text>
                {rec.code_ref && <Text style={styles.recCode}>{rec.code_ref}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Inspection Checklist by Category */}
      {categories.map(cat => {
        const catItems = checklist?.items?.filter((i: any) => i.category === cat) || [];
        const catColor = CAT_COLORS[cat] || Colors.grayInactive;
        const checkedCount = catItems.filter((i: any) => i.checked).length;
        return (
          <View key={cat} style={styles.catSection}>
            <View style={styles.catHeader}>
              <View style={[styles.catDot, { backgroundColor: catColor }]} />
              <Text style={styles.catTitle}>{cat}</Text>
              <Text style={styles.catCount}>{checkedCount}/{catItems.length}</Text>
            </View>
            {catItems.map((item: any, idx: number) => {
              const realIdx = checklist.items.indexOf(item);
              return (
                <TouchableOpacity key={idx} style={styles.checkRow} onPress={() => toggleItem(realIdx)}>
                  <View style={[styles.checkbox, item.checked && { backgroundColor: catColor, borderColor: catColor }]}>
                    {item.checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.checkItem, item.checked && styles.checkedText]}>{item.item}</Text>
                    <Text style={styles.checkMeta}>{item.code_ref} · {item.check_interval}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}

      {checklist?.items && (
        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>Save Progress</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  header: { gap: 4 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10 },
  aiBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  recsBox: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '30', gap: Spacing.sm },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  scoreNum: { fontSize: 28, fontWeight: '800' },
  recCard: { flexDirection: 'row', gap: 8, padding: Spacing.sm, backgroundColor: Colors.surfaceSecondary, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  recItem: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  recText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  recCode: { fontSize: 10, fontWeight: '600', color: Colors.primary },
  catSection: { gap: 4 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  catDot: { width: 12, height: 12, borderRadius: 6 },
  catTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  catCount: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkItem: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  checkedText: { textDecorationLine: 'line-through', color: Colors.grayInactive },
  checkMeta: { fontSize: 10, color: Colors.grayInactive },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
