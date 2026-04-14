import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';

export default function SettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'property_manager';

  const sections = [
    { title: 'Account', items: [
      { icon: 'person', label: 'Profile', desc: 'Edit your profile', route: '' },
      { icon: 'notifications', label: 'Notifications', desc: 'Manage notification settings', route: '/notifications' },
      { icon: 'language', label: 'Language', desc: 'English', route: '' },
    ]},
    ...(isAdmin ? [{ title: 'Admin', items: [
      { icon: 'clipboard', label: 'Review Queue', desc: 'AI estimates awaiting approval', route: '/admin-review' },
      { icon: 'cash', label: 'Service Company Rates', desc: 'Labor rates, markups used by AI estimates', route: '/service-rates' },
      { icon: 'checkmark-done', label: 'Property Services', desc: 'Select services per property for inspections', route: '/property-services' },
    ]}] : []),
    { title: 'Integrations', items: [
      { icon: 'link', label: 'Reservation Sync', desc: 'Airbnb, Vrbo, Booking.com', route: '' },
      { icon: 'card', label: 'Payouts', desc: 'Payment method settings', route: '' },
    ]},
    { title: 'Organization', items: [
      { icon: 'business', label: 'Company', desc: user?.company_name || 'Set up company', route: '' },
      { icon: 'people', label: 'Team Roles', desc: 'Manage permissions', route: '/team' },
      { icon: 'color-palette', label: 'Branding', desc: 'Customize your branding', route: '' },
    ]},
    { title: 'Support', items: [
      { icon: 'help-circle', label: 'Help Center', desc: 'FAQ and guides', route: '' },
      { icon: 'chatbubble-ellipses', label: 'Contact Support', desc: '24/7 support', route: '' },
      { icon: 'information-circle', label: 'About', desc: 'Property Pulse v2.0', route: '' },
    ]},
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {sections.map((section, si) => (
        <View key={si} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionCard}>
            {section.items.map((item, ii) => (
              <TouchableOpacity
                key={ii}
                testID={`setting-${item.label.replace(/\s/g, '-').toLowerCase()}`}
                style={[styles.item, ii < section.items.length - 1 && styles.itemBorder]}
                onPress={() => { if (item.route) router.push(item.route as any); }}
              >
                <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Text style={styles.itemDesc}>{item.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.grayInactive} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.lg, paddingBottom: 40 },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 4 },
  sectionCard: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemInfo: { flex: 1, gap: 1 },
  itemLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  itemDesc: { fontSize: 12, color: Colors.textSecondary },
});
