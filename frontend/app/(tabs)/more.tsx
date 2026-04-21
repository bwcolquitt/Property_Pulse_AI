import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

const menuItems = [
  { label: 'Setup Wizard', icon: 'rocket', route: '/setup-wizard', color: Colors.primary },
  { label: 'Host Inbox', icon: 'mail', route: '/host-inbox', color: Colors.redUrgent },
  { label: 'Send Guest Access', icon: 'link', route: '/send-guest-link', color: Colors.primary },
  { label: 'Properties', icon: 'home', route: '/property/list', color: Colors.primary },
  { label: 'Inspections', icon: 'clipboard', route: '/inspections', color: Colors.purpleAwaiting },
  { label: 'Inventory', icon: 'cube', route: '/inventory', color: Colors.accent },
  { label: 'Owner Storage', icon: 'file-tray-stacked', route: '/owners-inventory', color: Colors.accent },
  { label: 'Calendar', icon: 'calendar', route: '/calendar', color: Colors.greenReady },
  { label: 'Reservations', icon: 'bed', route: '/reservations', color: Colors.blueAssigned },
  { label: 'Messages', icon: 'chatbubbles', route: '/messages', color: Colors.blueAssigned },
  { label: 'Reports', icon: 'bar-chart', route: '/reports', color: Colors.purpleAwaiting },
  { label: 'AI Command', icon: 'sparkles', route: '/ai-command', color: Colors.accent },
  { label: 'Recurring Schedules', icon: 'repeat', route: '/recurring-schedules', color: Colors.greenReady },
  { label: 'Provider Calendar', icon: 'people-circle', route: '/provider-calendar', color: Colors.secondary },
  { label: 'Job Board', icon: 'briefcase', route: '/job-board', color: Colors.primary },
  { label: 'Supply Requests', icon: 'cart', route: '/supply-requests', color: Colors.yellowAtRisk },
  { label: 'On-Site Purchases', icon: 'receipt', route: '/onsite-purchases', color: Colors.accent },
  { label: 'Improvements', icon: 'bulb', route: '/improvements', color: '#FF9800' },
  { label: 'Inspection Prep', icon: 'clipboard', route: '/inspection-prep', color: Colors.redUrgent },
  { label: 'Service Notes', icon: 'document-lock', route: '/property-notes', color: Colors.blueAssigned },
  { label: 'Assets', icon: 'shield-checkmark', route: '/assets', color: Colors.redUrgent },
  { label: 'Payments', icon: 'card', route: '/payment-settings', color: Colors.greenReady },
  { label: 'SMS Delivery', icon: 'chatbox-ellipses', route: '/sms-config', color: Colors.secondary },
  { label: 'Email Delivery', icon: 'mail-open', route: '/email-config', color: Colors.accent },
  { label: 'PMS Integrations', icon: 'link', route: '/pms-connect', color: Colors.primary },
  { label: 'iCal Feeds', icon: 'calendar', route: '/ical-feeds', color: Colors.primary },
  { label: 'Cleaner Scorecards', icon: 'trophy', route: '/cleaner-scorecards', color: Colors.accent },
  { label: 'Housecall Pro', icon: 'hammer', route: '/hcp-config', color: Colors.accent },
  { label: 'Guest Booking', icon: 'bed', route: '/guest-book', color: Colors.blueAssigned },
  { label: 'Help Center', icon: 'book', route: '/help-center', color: Colors.purpleAwaiting },
  { label: 'AI Assistant', icon: 'chatbubble-ellipses', route: '/ai-assistant', color: Colors.accent },
  { label: 'Company Config', icon: 'business', route: '/company-config', color: Colors.primary },
  { label: 'Team', icon: 'people', route: '/team', color: Colors.secondary },
  { label: 'Settings', icon: 'settings', route: '/settings', color: Colors.grayInactive },
];

export default function MoreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.first_name} {user?.last_name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{(user?.role || '').replace(/_/g, ' ')}</Text>
          </View>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        {menuItems.map((item, i) => (
          <TouchableOpacity
            key={i}
            testID={`menu-${item.label.toLowerCase()}`}
            style={styles.menuItem}
            onPress={() => router.push(item.route as any)}
          >
            <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
              <Ionicons name={item.icon as any} size={22} color={item.color} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.grayInactive} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity
        testID="logout-btn"
        style={styles.logoutBtn}
        onPress={async () => {
          await logout();
          // Auth routing handled by _layout.tsx RootNavigator
        }}
      >
        <Ionicons name="log-out-outline" size={22} color={Colors.redUrgent} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Property Pulse AI v2.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: Colors.primaryForeground },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  profileEmail: { fontSize: 13, color: Colors.textSecondary },
  roleBadge: { backgroundColor: Colors.primary + '12', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },
  roleText: { fontSize: 11, fontWeight: '700', color: Colors.primary, textTransform: 'capitalize' },
  menuSection: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.redUrgent + '10', borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: Colors.redUrgent + '30' },
  logoutText: { fontSize: 16, fontWeight: '700', color: Colors.redUrgent },
  version: { textAlign: 'center', fontSize: 12, color: Colors.grayInactive, marginTop: Spacing.sm },
});
