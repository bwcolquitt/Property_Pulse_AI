import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';

export default function SettingsScreen() {
  const { user } = useAuth();

  const sections = [
    { title: 'Account', items: [
      { icon: 'person', label: 'Profile', desc: 'Edit your profile' },
      { icon: 'notifications', label: 'Notifications', desc: 'Manage notification settings' },
      { icon: 'language', label: 'Language', desc: 'English' },
    ]},
    { title: 'Integrations', items: [
      { icon: 'link', label: 'Reservation Sync', desc: 'Airbnb, Vrbo, Booking.com' },
      { icon: 'card', label: 'Payouts', desc: 'Payment method settings' },
    ]},
    { title: 'Organization', items: [
      { icon: 'business', label: 'Company', desc: user?.company_name || 'Set up company' },
      { icon: 'people', label: 'Team Roles', desc: 'Manage permissions' },
      { icon: 'color-palette', label: 'Branding', desc: 'Customize your branding' },
    ]},
    { title: 'Support', items: [
      { icon: 'help-circle', label: 'Help Center', desc: 'FAQ and guides' },
      { icon: 'chatbubble-ellipses', label: 'Contact Support', desc: '24/7 support' },
      { icon: 'information-circle', label: 'About', desc: 'PropertyPulse v1.0.0' },
    ]},
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {sections.map((section, si) => (
        <View key={si} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionCard}>
            {section.items.map((item, ii) => (
              <TouchableOpacity key={ii} testID={`setting-${item.label.replace(/\s/g, '-').toLowerCase()}`} style={[styles.item, ii < section.items.length - 1 && styles.itemBorder]}>
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
