import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const markRead = async (id: string) => {
    try { await api.put(`/notifications/${id}/read`); fetch(); } catch {}
  };

  const markAllRead = async () => {
    try { await api.put('/notifications/read-all'); fetch(); } catch {}
  };

  const getIcon = (type: string) => {
    if (type.includes('turnover')) return 'refresh-circle';
    if (type.includes('maintenance')) return 'construct';
    if (type.includes('inspection')) return 'clipboard';
    return 'notifications';
  };

  const getColor = (type: string) => {
    if (type.includes('turnover')) return Colors.primary;
    if (type.includes('maintenance')) return Colors.redUrgent;
    if (type.includes('inspection')) return Colors.purpleAwaiting;
    return Colors.blueAssigned;
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {notifications.length > 0 && (
        <TouchableOpacity testID="mark-all-read" style={styles.markAllBtn} onPress={markAllRead}>
          <Ionicons name="checkmark-done" size={18} color={Colors.primary} />
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={notifications}
        keyExtractor={n => n.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={fetch} tintColor={Colors.primary} />}
        renderItem={({ item: n }) => {
          const isUnread = !n.read_at;
          const color = getColor(n.type);
          return (
            <TouchableOpacity
              testID={`notif-${n.id}`}
              style={[styles.card, isUnread && styles.cardUnread]}
              onPress={() => { markRead(n.id); if (n.action_url) router.push(n.action_url as any); }}
            >
              <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
                <Ionicons name={getIcon(n.type) as any} size={20} color={color} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, isUnread && styles.cardTitleBold]}>{n.title}</Text>
                <Text style={styles.cardBody} numberOfLines={2}>{n.body}</Text>
                <Text style={styles.cardTime}>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</Text>
              </View>
              {isUnread && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.grayInactive} />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyText}>You'll be notified when turnovers start, complete, or need attention.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  markAllText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  cardUnread: { backgroundColor: Colors.primary + '06', borderColor: Colors.primary + '25' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  cardContent: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 14, color: Colors.textPrimary },
  cardTitleBold: { fontWeight: '700' },
  cardBody: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  cardTime: { fontSize: 11, color: Colors.grayInactive, marginTop: 4 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginTop: 6 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
