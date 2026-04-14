import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { Colors, Spacing, StatusColors } from '../src/constants/theme';
import api from '../src/utils/api';

export default function CalendarScreen() {
  const router = useRouter();
  const [turnovers, setTurnovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/turnovers');
        setTurnovers(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  // Build marked dates from turnovers
  const markedDates: any = {};
  turnovers.forEach(t => {
    if (t.due_at) {
      const date = t.due_at.split('T')[0];
      const color = StatusColors[t.status] || Colors.blueAssigned;
      if (!markedDates[date]) {
        markedDates[date] = { dots: [{ key: t.id, color }], marked: true };
      } else {
        markedDates[date].dots.push({ key: t.id, color });
      }
    }
  });
  // Highlight selected date
  markedDates[selectedDate] = { ...markedDates[selectedDate], selected: true, selectedColor: Colors.primary + '20', selectedTextColor: Colors.primary };

  // Filter turnovers for selected date
  const dayTurnovers = turnovers.filter(t => t.due_at && t.due_at.split('T')[0] === selectedDate);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container}>
      <Calendar
        testID="turnover-calendar"
        current={selectedDate}
        onDayPress={(day: any) => setSelectedDate(day.dateString)}
        markingType="multi-dot"
        markedDates={markedDates}
        theme={{
          backgroundColor: Colors.background,
          calendarBackground: Colors.surface,
          textSectionTitleColor: Colors.textSecondary,
          selectedDayBackgroundColor: Colors.primary,
          selectedDayTextColor: Colors.primaryForeground,
          todayTextColor: Colors.primary,
          dayTextColor: Colors.textPrimary,
          textDisabledColor: Colors.grayInactive,
          dotColor: Colors.primary,
          selectedDotColor: Colors.primaryForeground,
          arrowColor: Colors.primary,
          monthTextColor: Colors.textPrimary,
          textDayFontWeight: '500',
          textMonthFontWeight: '700',
          textDayHeaderFontWeight: '600',
        }}
        style={styles.calendar}
      />

      <View style={styles.daySection}>
        <Text style={styles.dayTitle}>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <Text style={styles.dayCount}>{dayTurnovers.length} turnover{dayTurnovers.length !== 1 ? 's' : ''}</Text>

        {dayTurnovers.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={32} color={Colors.grayInactive} />
            <Text style={styles.emptyText}>No turnovers scheduled</Text>
          </View>
        )}

        {dayTurnovers.map((t, i) => {
          const color = StatusColors[t.status] || Colors.grayInactive;
          return (
            <TouchableOpacity key={i} testID={`cal-turnover-${t.id}`} style={styles.card} onPress={() => router.push(`/turnover/${t.id}`)}>
              <View style={[styles.cardStripe, { backgroundColor: color }]} />
              <View style={styles.cardContent}>
                <View style={[styles.badge, { backgroundColor: color + '15' }]}>
                  <Text style={[styles.badgeText, { color }]}>{(t.status || '').replace(/_/g, ' ')}</Text>
                </View>
                <Text style={styles.cardTitle}>{t.title}</Text>
                <Text style={styles.cardSub}>{t.property_name}</Text>
                <View style={styles.cardMeta}>
                  <Ionicons name="person" size={14} color={Colors.textSecondary} />
                  <Text style={styles.metaText}>{t.assigned_name}</Text>
                  <View style={styles.progressMini}>
                    <View style={[styles.progressFill, { width: `${t.checklist_progress || 0}%` }]} />
                  </View>
                  <Text style={styles.metaText}>{t.checklist_progress || 0}%</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  calendar: { borderRadius: 12, margin: Spacing.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  daySection: { padding: Spacing.md, gap: Spacing.sm },
  dayTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  dayCount: { fontSize: 13, color: Colors.textSecondary },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.grayInactive },
  card: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  cardStripe: { width: 4 },
  cardContent: { flex: 1, padding: Spacing.md, gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardSub: { fontSize: 13, color: Colors.textSecondary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  progressMini: { flex: 1, height: 4, backgroundColor: Colors.surfaceSecondary, borderRadius: 2, marginLeft: 4 },
  progressFill: { height: 4, backgroundColor: Colors.greenReady, borderRadius: 2 },
});
