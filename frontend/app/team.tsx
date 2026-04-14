import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function TeamScreen() {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/reports/team');
        setTeam(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const roleColors: Record<string, string> = { property_manager: Colors.primary, cleaner: Colors.secondary, maintenance_technician: Colors.accent, inspector: Colors.purpleAwaiting };

  return (
    <FlatList
      style={styles.container}
      data={team}
      keyExtractor={u => u.id}
      contentContainerStyle={styles.list}
      renderItem={({ item: u }) => (
        <View testID={`team-member-${u.id}`} style={styles.card}>
          <View style={[styles.avatar, { backgroundColor: (roleColors[u.role] || Colors.grayInactive) + '20' }]}>
            <Text style={[styles.avatarText, { color: roleColors[u.role] || Colors.grayInactive }]}>{(u.first_name?.[0] || '') + (u.last_name?.[0] || '')}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{u.first_name} {u.last_name}</Text>
            <Text style={styles.email}>{u.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: (roleColors[u.role] || Colors.grayInactive) + '12' }]}>
              <Text style={[styles.roleText, { color: roleColors[u.role] || Colors.grayInactive }]}>{(u.role || '').replace(/_/g, ' ')}</Text>
            </View>
          </View>
          <View style={styles.stats}>
            <View style={styles.statItem}><Text style={styles.statValue}>{u.assigned_turnovers}</Text><Text style={styles.statLabel}>Turns</Text></View>
            <View style={styles.statItem}><Text style={styles.statValue}>{u.assigned_issues}</Text><Text style={styles.statLabel}>Issues</Text></View>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  email: { fontSize: 12, color: Colors.textSecondary },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginTop: 2 },
  roleText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 10, color: Colors.textSecondary },
});
