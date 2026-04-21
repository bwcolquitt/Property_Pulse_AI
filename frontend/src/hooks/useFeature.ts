/**
 * useFeature - returns whether a feature is available for the current tenant.
 *
 * Usage:
 *   const { hasFeature, showUpgrade, UpgradeModalComponent } = useFeature('sms');
 *   if (!hasFeature) { showUpgrade(); return; }
 *   ...proceed with SMS action...
 */
import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import UpgradeModal from '../components/UpgradeModal';

const FEATURE_TIER: Record<string, string> = {
  sms: 'pro', email: 'pro', pms: 'pro', ai: 'pro', otp: 'pro',
  white_label: 'pro', push: 'pro', assets: 'pro', owner_storage: 'pro',
  csv_export: 'pro', advanced_reports: 'pro',
  hcp: 'enterprise', scorecards: 'enterprise', api_access: 'enterprise',
  multi_admin: 'enterprise', custom_domain: 'enterprise',
};
const TIER_ORDER: Record<string, number> = { starter: 1, pro: 2, enterprise: 3 };

let cachedTenant: any = null;
let cacheTime = 0;

export function useFeature(feature: string) {
  const [tenant, setTenant] = useState<any>(cachedTenant);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (cachedTenant && Date.now() - cacheTime < 60000) return;
    api.get('/tenants/me').then(r => { cachedTenant = r.data; cacheTime = Date.now(); setTenant(r.data); }).catch(() => {});
  }, []);

  const currentPlan = tenant?.plan || 'starter';
  const requiredPlan = FEATURE_TIER[feature] || 'starter';
  const hasFeature = (TIER_ORDER[currentPlan] || 0) >= (TIER_ORDER[requiredPlan] || 99);

  const showUpgrade = () => setModalOpen(true);

  const UpgradeModalComponent = (
    <UpgradeModal visible={modalOpen} onClose={() => setModalOpen(false)} feature={feature} requiredPlan={requiredPlan} />
  );

  return { hasFeature, showUpgrade, UpgradeModalComponent, currentPlan, requiredPlan };
}
