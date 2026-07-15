/**
 * MessageBanner - Global in-app banner that pops in when new team messages arrive.
 *
 * Polls /api/messages/unread-count every 8 seconds when app is open.
 * When unread count increases, shows an animated banner with the latest message.
 * Tapping banner navigates to /team-messages.
 * Auto-dismisses after 6 seconds or on tap.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../constants/theme';
import api from '../utils/api';

const POLL_MS = 8000;

interface RecentMsg {
  id: string;
  body: string;
  sender_name: string;
  sender_role: string;
  message_type: string;
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  property_manager: Colors.primary,
  admin: Colors.primary,
  cleaner: Colors.purpleAwaiting,
  maintenance: Colors.accent,
  vendor: Colors.secondary,
};

export default function MessageBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const [banner, setBanner] = useState<RecentMsg | null>(null);
  const [lastSeenTs, setLastSeenTs] = useState<string>('');
  const translateY = useRef(new Animated.Value(-120)).current;
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showBanner = (msg: RecentMsg) => {
    setBanner(msg);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 8 }).start();
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(hideBanner, 6000);
  };

  const hideBanner = () => {
    Animated.timing(translateY, { toValue: -120, useNativeDriver: true, duration: 250 }).start(() => setBanner(null));
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  };

  const poll = async () => {
    // Skip when already on messages screen
    if (pathname === '/team-messages') return;
    try {
      const { data } = await api.get('/messages/recent-unread');
      if (data && data.length > 0) {
        const newest = data[0];
        if (newest.created_at > lastSeenTs) {
          setLastSeenTs(newest.created_at);
          if (lastSeenTs) showBanner(newest);  // Only show if we've polled before (avoid firing on first-ever load)
        }
      }
    } catch {}
  };

  useEffect(() => {
    // Initial load — set baseline without showing banner
    (async () => {
      try {
        const { data } = await api.get('/messages/recent-unread');
        if (data && data.length > 0) setLastSeenTs(data[0].created_at);
        else setLastSeenTs(new Date().toISOString());
      } catch { setLastSeenTs(new Date().toISOString()); }
    })();
    const t = setInterval(poll, POLL_MS);
    return () => { clearInterval(t); if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSeenTs, pathname]);

  if (!banner) return null;

  const preview = banner.body || (banner.message_type === 'photo' ? '📷 Photo' : '🎤 Voice note');
  const accentColor = ROLE_COLORS[banner.sender_role] || Colors.primary;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }], borderLeftColor: accentColor }]} testID="message-banner">
      <TouchableOpacity style={styles.inner} onPress={() => { hideBanner(); router.push('/team-messages'); }}>
        <View style={[styles.iconBox, { backgroundColor: accentColor + '20' }]}>
          <Ionicons name="chatbubble" size={18} color={accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.senderText} numberOfLines={1}>
            <Text style={{ fontWeight: '800' }}>{banner.sender_name}</Text>
            {banner.sender_role ? <Text style={styles.roleText}>  ·  {banner.sender_role.replace(/_/g, ' ')}</Text> : null}
          </Text>
          <Text style={styles.bodyText} numberOfLines={2}>{preview}</Text>
        </View>
        <TouchableOpacity onPress={hideBanner} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 40,
    left: 8,
    right: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  senderText: { fontSize: 13, color: Colors.textPrimary },
  roleText: { fontSize: 11, color: Colors.textSecondary, textTransform: 'capitalize', fontWeight: '600' },
  bodyText: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
