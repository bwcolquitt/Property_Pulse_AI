/**
 * useBadges - custom hook that fetches dashboard badge counts with polling.
 */
import { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';

export interface BadgeCounts {
  host_inbox_new: number;
  outstanding_issues: number;
  urgent_issues: number;
  pending_turnovers: number;
  unread_notifications: number;
  low_inventory: number;
  setup_incomplete: number;
  team_messages_unread: number;
}

export function useBadges(pollMs: number = 60000) {
  const [badges, setBadges] = useState<BadgeCounts | null>(null);

  const fetchBadges = useCallback(async () => {
    try {
      const { data } = await api.get('/badges');
      setBadges(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchBadges();
    if (pollMs > 0) {
      const t = setInterval(fetchBadges, pollMs);
      return () => clearInterval(t);
    }
  }, [fetchBadges, pollMs]);

  return { badges, refetch: fetchBadges };
}
