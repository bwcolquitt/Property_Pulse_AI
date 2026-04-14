import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const ALL_SERVICES = [
  { id: 'cleaning', label: 'Cleaning', icon: 'sparkles', color: Colors.purpleAwaiting, desc: 'Standard turnover cleaning' },
  { id: 'maintenance', label: 'Maintenance', icon: 'construct', color: Colors.primary, desc: 'General handyman & repairs' },
  { id: 'pool', label: 'Pool/Spa', icon: 'water', color: Colors.secondary, desc: 'Pool & spa maintenance' },
  { id: 'plumbing', label: 'Plumbing', icon: 'water', color: Colors.blueAssigned, desc: 'Plumbing repairs & fixtures' },
  { id: 'electrical', label: 'Electrical', icon: 'flash', color: Colors.accent, desc: 'Electrical work & lighting' },
  { id: 'hvac', label: 'HVAC', icon: 'thermometer', color: Colors.redUrgent, desc: 'Heating, cooling, ventilation' },
  { id: 'appliance', label: 'Appliance', icon: 'tv', color: Colors.textSecondary, desc: 'Appliance repair & service' },
  { id: 'landscaping', label: 'Landscaping', icon: 'leaf', color: Colors.greenReady, desc: 'Lawn, garden, exterior' },
  { id: 'pest_control', label: 'Pest Control', icon: 'bug', color: '#8B4513', desc: 'Pest management' },
];

export default function PropertyServicesScreen() {
  const [properties, setProperties] = useState<any[]>([]);
  const [configs, setConfigs] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: props } = await api.get('/properties');
        setProperties(props);
        const cfgs: Record<string, string[]> = {};
        for (const p of props) {
          try {
            const { data } = await api.get(`/service-settings/property-services/${p.id}`);
            cfgs[p.id] = data.services || ['cleaning', 'maintenance'];
          } catch { cfgs[p.id] = ['cleaning', 'maintenance']; }
        }
        setConfigs(cfgs);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const toggleService = async (propId: string, serviceId: string) => {
    const current = configs[propId] || [];
    const updated = current.includes(serviceId) ? current.filter(s => s !== serviceId) : [...current, serviceId];
    setConfigs({ ...configs, [propId]: updated });
    setSaving(propId);
    try {
      await api.put('/service-settings/property-services', { property_id: propId, services: updated });
    } catch { Alert.alert('Error', 'Failed to save'); }
    finally { setSaving(null); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Property Services</Text>
      <Text style={styles.subtitle}>Select which services each property requires. These will appear on inspection checklists.</Text>

      {properties.map((prop, pi) => {
        const propServices = configs[prop.id] || [];
        return (
          <View key={pi} style={styles.propCard}>
            <View style={styles.propHeader}>
              <Ionicons name="home" size={20} color={Colors.primary} />
              <View style={styles.propInfo}>
                <Text style={styles.propName}>{prop.nickname || prop.name}</Text>
                <Text style={styles.propAddr}>{prop.address_1}, {prop.city}</Text>
              </View>
              {saving === prop.id && <ActivityIndicator size="small" color={Colors.primary} />}
              <Text style={styles.serviceCount}>{propServices.length} active</Text>
            </View>
            <View style={styles.serviceGrid}>
              {ALL_SERVICES.map(svc => {
                const active = propServices.includes(svc.id);
                return (
                  <TouchableOpacity
                    key={svc.id}
                    testID={`svc-${prop.id}-${svc.id}`}
                    style={[styles.serviceChip, active && { backgroundColor: svc.color + '18', borderColor: svc.color }]}
                    onPress={() => toggleService(prop.id, svc.id)}
                  >
                    <Ionicons name={svc.icon as any} size={16} color={active ? svc.color : Colors.grayInactive} />
                    <Text style={[styles.serviceLabel, active && { color: svc.color }]}>{svc.label}</Text>
                    {active && <Ionicons name="checkmark-circle" size={14} color={svc.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  propCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  propHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  propInfo: { flex: 1 },
  propName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  propAddr: { fontSize: 12, color: Colors.textSecondary },
  serviceCount: { fontSize: 12, fontWeight: '600', color: Colors.primary, backgroundColor: Colors.primary + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  serviceLabel: { fontSize: 12, fontWeight: '600', color: Colors.grayInactive },
});
