export const Colors = {
  background: '#FDFBF7',
  surface: '#FFFFFF',
  surfaceSecondary: '#F5F2EA',
  border: '#E2E0D9',
  primary: '#006D77',
  primaryForeground: '#FFFFFF',
  secondary: '#83C5BE',
  secondaryForeground: '#1A2E35',
  accent: '#E29578',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  // Status colors
  greenReady: '#10B981',
  yellowAtRisk: '#F59E0B',
  redUrgent: '#EF4444',
  blueAssigned: '#3B82F6',
  purpleAwaiting: '#8B5CF6',
  grayInactive: '#9CA3AF',
};

export const StatusColors: Record<string, string> = {
  new: Colors.blueAssigned,
  not_started: Colors.grayInactive,
  assigned: Colors.blueAssigned,
  in_progress: Colors.blueAssigned,
  awaiting_approval: Colors.purpleAwaiting,
  awaiting_parts: Colors.purpleAwaiting,
  scheduled: Colors.blueAssigned,
  blocked: Colors.redUrgent,
  reopened: Colors.yellowAtRisk,
  completed: Colors.greenReady,
  cancelled: Colors.grayInactive,
  ready_for_inspection: Colors.yellowAtRisk,
  passed: Colors.greenReady,
  failed: Colors.redUrgent,
  pending: Colors.yellowAtRisk,
  // Turnover statuses
  at_risk: Colors.yellowAtRisk,
  normal: Colors.greenReady,
};

export const PriorityColors: Record<string, string> = {
  urgent: Colors.redUrgent,
  high: Colors.accent,
  medium: Colors.yellowAtRisk,
  low: Colors.greenReady,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
