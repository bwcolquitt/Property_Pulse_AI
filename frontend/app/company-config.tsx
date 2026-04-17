import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import api from '../src/utils/api';

const SECTIONS = [
  { key: 'profile', label: 'Company Profile', icon: 'business', color: Colors.primary },
  { key: 'contacts', label: 'Contact Directory', icon: 'call', color: Colors.greenReady },
  { key: 'check_in_out', label: 'Check-in / Check-out', icon: 'key', color: Colors.blueAssigned },
  { key: 'house_rules', label: 'House Rules', icon: 'document-text', color: Colors.purpleAwaiting },
  { key: 'emergency', label: 'Emergency Procedures', icon: 'medkit', color: Colors.redUrgent },
  { key: 'communication', label: 'Communication', icon: 'chatbubbles', color: Colors.secondary },
  { key: 'legal', label: 'Legal & Policies', icon: 'shield-checkmark', color: Colors.accent },
  { key: 'faqs', label: 'Custom FAQs', icon: 'help-circle', color: '#607D8B' },
];

const DEFAULT_PROCEDURES = [
  { procedure_type: 'fire', title: 'Fire', instructions: '', contact_name: '', contact_phone: '' },
  { procedure_type: 'flood', title: 'Water / Flood', instructions: '', contact_name: '', contact_phone: '' },
  { procedure_type: 'power_outage', title: 'Power Outage', instructions: '', contact_name: '', contact_phone: '' },
  { procedure_type: 'medical', title: 'Medical Emergency', instructions: '', contact_name: '', contact_phone: '' },
  { procedure_type: 'lockout', title: 'Lockout', instructions: '', contact_name: '', contact_phone: '' },
  { procedure_type: 'gas_leak', title: 'Gas Leak', instructions: '', contact_name: '', contact_phone: '' },
];

export default function CompanySettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  const [config, setConfig] = useState<any>({});

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/company-config');
        setConfig(data || {});
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const updateField = (section: string, field: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const saveSection = async (section: string, endpoint: string) => {
    setSaving(true);
    try {
      await api.put(`/company-config/${endpoint}`, config[section] || {});
      Alert.alert('Saved', `${SECTIONS.find(s => s.key === section)?.label} updated`);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save');
    }
    finally { setSaving(false); }
  };

  const Field = ({ section, field, label, placeholder, multiline, keyboardType }: any) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]} value={config[section]?.[field] || ''} onChangeText={v => updateField(section, field, v)} placeholder={placeholder} placeholderTextColor={Colors.grayInactive} multiline={multiline} keyboardType={keyboardType} />
    </View>
  );

  const Toggle = ({ section, field, label, subtitle }: any) => (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}><Text style={styles.toggleLabel}>{label}</Text>{subtitle && <Text style={styles.toggleSub}>{subtitle}</Text>}</View>
      <Switch value={!!config[section]?.[field]} onValueChange={v => updateField(section, field, v)} trackColor={{ true: Colors.primary, false: Colors.border }} />
    </View>
  );

  const SaveBtn = ({ section, endpoint }: any) => (
    <TouchableOpacity style={styles.saveBtn} onPress={() => saveSection(section, endpoint)} disabled={saving}>
      {saving ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.saveBtnText}>Save Changes</Text></>}
    </TouchableOpacity>
  );

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <View style={styles.container}>
      {/* Section Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
        {SECTIONS.map(s => (
          <TouchableOpacity key={s.key} style={[styles.sTab, activeSection === s.key && { backgroundColor: s.color, borderColor: s.color }]} onPress={() => setActiveSection(s.key)}>
            <Ionicons name={s.icon as any} size={14} color={activeSection === s.key ? '#fff' : s.color} />
            <Text style={[styles.sTabText, activeSection === s.key && { color: '#fff' }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* Company Profile */}
        {activeSection === 'profile' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}><Ionicons name="business" size={20} color={Colors.primary} /><Text style={styles.sectionTitle}>Company Profile</Text></View>
            <Text style={styles.sectionHint}>Your company identity. This appears in guides, AI chat, and guest communications.</Text>
            <Field section="profile" field="company_name" label="Company Name" placeholder="Oceanview Rentals LLC" />
            <Field section="profile" field="tagline" label="Tagline" placeholder="Premium beach rentals in Newport Beach" />
            <Field section="profile" field="logo_url" label="Logo URL" placeholder="https://..." />
            <Field section="profile" field="website" label="Website" placeholder="https://yourcompany.com" />
            <Field section="profile" field="primary_color" label="Primary Color (hex)" placeholder="#0A4F7F" />
            <Field section="profile" field="accent_color" label="Accent Color (hex)" placeholder="#DDA239" />
            <SaveBtn section="profile" endpoint="profile" />
          </View>
        )}

        {/* Contact Directory */}
        {activeSection === 'contacts' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}><Ionicons name="call" size={20} color={Colors.greenReady} /><Text style={styles.sectionTitle}>Contact Directory</Text></View>
            <Text style={styles.sectionHint}>These numbers appear in guides and AI assistant answers.</Text>
            <Field section="contacts" field="main_phone" label="Main Office Phone" placeholder="(949) 555-0100" />
            <Field section="contacts" field="main_email" label="Main Office Email" placeholder="info@yourcompany.com" />
            <Field section="contacts" field="emergency_phone" label="Emergency Phone (24/7)" placeholder="(949) 555-0911" />
            <Field section="contacts" field="after_hours_phone" label="After-Hours Phone" placeholder="(949) 555-0200" />
            <Field section="contacts" field="after_hours_email" label="After-Hours Email" placeholder="urgent@yourcompany.com" />
            <Field section="contacts" field="maintenance_hotline" label="Maintenance Hotline" placeholder="(949) 555-0300" />
            <Field section="contacts" field="office_address" label="Office Address" placeholder="123 Pacific Coast Hwy" />
            <Field section="contacts" field="office_hours" label="Office Hours" placeholder="Mon-Fri 9am-5pm, Sat 10am-2pm" />
            <SaveBtn section="contacts" endpoint="contacts" />
          </View>
        )}

        {/* Check-in / Check-out */}
        {activeSection === 'check_in_out' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}><Ionicons name="key" size={20} color={Colors.blueAssigned} /><Text style={styles.sectionTitle}>Check-in / Check-out</Text></View>
            <Text style={styles.sectionHint}>Default policies shown to guests in guides and booking confirmations.</Text>
            <Field section="check_in_out" field="default_check_in_time" label="Check-in Time" placeholder="3:00 PM" />
            <Field section="check_in_out" field="default_check_out_time" label="Check-out Time" placeholder="11:00 AM" />
            <Toggle section="check_in_out" field="early_check_in_available" label="Early Check-in Available" />
            <Field section="check_in_out" field="early_check_in_fee" label="Early Check-in Fee ($)" placeholder="50" keyboardType="numeric" />
            <Toggle section="check_in_out" field="late_check_out_available" label="Late Check-out Available" />
            <Field section="check_in_out" field="late_check_out_fee" label="Late Check-out Fee ($)" placeholder="50" keyboardType="numeric" />
            <Field section="check_in_out" field="key_exchange_method" label="Key Exchange Method" placeholder="lockbox / smart_lock / in_person" />
            <Field section="check_in_out" field="lockbox_instructions" label="Lockbox Instructions" placeholder="The lockbox is on the front door. Code: 1234" multiline />
            <Field section="check_in_out" field="smart_lock_instructions" label="Smart Lock Instructions" placeholder="Download the app and use code sent via email" multiline />
            <Field section="check_in_out" field="check_in_instructions" label="Check-in Instructions" placeholder="Park in the driveway. Enter through the front door." multiline />
            <Field section="check_in_out" field="check_out_instructions" label="Check-out Instructions" placeholder="Start dishwasher, take out trash, lock all doors." multiline />
            <Field section="check_in_out" field="access_notes" label="Access Notes" placeholder="Gate code: #5678. Ring doorbell on arrival." multiline />
            <SaveBtn section="check_in_out" endpoint="check-in-out" />
          </View>
        )}

        {/* House Rules */}
        {activeSection === 'house_rules' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}><Ionicons name="document-text" size={20} color={Colors.purpleAwaiting} /><Text style={styles.sectionTitle}>House Rules</Text></View>
            <Text style={styles.sectionHint}>Global defaults. Can be overridden per property.</Text>
            <Field section="house_rules" field="quiet_hours_start" label="Quiet Hours Start" placeholder="10:00 PM" />
            <Field section="house_rules" field="quiet_hours_end" label="Quiet Hours End" placeholder="8:00 AM" />
            <Field section="house_rules" field="parking_rules" label="Parking Rules" placeholder="2 cars max in driveway. No street parking." multiline />
            <Toggle section="house_rules" field="pets_allowed" label="Pets Allowed" />
            <Field section="house_rules" field="pet_fee" label="Pet Fee ($)" placeholder="100" keyboardType="numeric" />
            <Field section="house_rules" field="pet_rules" label="Pet Rules" placeholder="Max 2 pets, 50lb limit. Clean up after pets." multiline />
            <Toggle section="house_rules" field="smoking_allowed" label="Smoking Allowed" />
            <Field section="house_rules" field="smoking_rules" label="Smoking Rules" placeholder="Outdoor designated areas only" />
            <Field section="house_rules" field="pool_hours" label="Pool Hours" placeholder="8 AM - 10 PM" />
            <Field section="house_rules" field="pool_rules" label="Pool Rules" placeholder="No glass near pool. Supervise children at all times." multiline />
            <Field section="house_rules" field="trash_day" label="Trash Day" placeholder="Tuesday & Friday" />
            <Field section="house_rules" field="trash_instructions" label="Trash Instructions" placeholder="Roll bins to curb by 7 AM on trash day" multiline />
            <Field section="house_rules" field="wifi_network" label="WiFi Network Name" placeholder="OceanView-Guest" />
            <Field section="house_rules" field="wifi_password" label="WiFi Password" placeholder="beach2025" />
            <Field section="house_rules" field="additional_rules" label="Additional Rules" placeholder="No parties. No events over 10 people." multiline />
            <SaveBtn section="house_rules" endpoint="house-rules" />
          </View>
        )}

        {/* Emergency Procedures */}
        {activeSection === 'emergency' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}><Ionicons name="medkit" size={20} color={Colors.redUrgent} /><Text style={styles.sectionTitle}>Emergency Procedures</Text></View>
            <Text style={styles.sectionHint}>Step-by-step instructions for emergencies. Shown to guests and providers.</Text>
            {(config.emergency_procedures?.procedures || DEFAULT_PROCEDURES).map((proc: any, i: number) => (
              <View key={i} style={styles.procCard}>
                <View style={styles.procHeader}>
                  <Ionicons name="alert-circle" size={16} color={Colors.redUrgent} />
                  <Text style={styles.procTitle}>{proc.title || proc.procedure_type}</Text>
                </View>
                <TextInput style={[styles.input, { height: 60 }]} value={proc.instructions} onChangeText={v => {
                  const procs = [...(config.emergency_procedures?.procedures || DEFAULT_PROCEDURES)];
                  procs[i] = { ...procs[i], instructions: v };
                  setConfig((prev: any) => ({ ...prev, emergency_procedures: { ...prev.emergency_procedures, procedures: procs } }));
                }} placeholder="Instructions for this emergency..." placeholderTextColor={Colors.grayInactive} multiline />
                <View style={styles.procRow}>
                  <TextInput style={[styles.input, { flex: 1 }]} value={proc.contact_name} onChangeText={v => {
                    const procs = [...(config.emergency_procedures?.procedures || DEFAULT_PROCEDURES)];
                    procs[i] = { ...procs[i], contact_name: v };
                    setConfig((prev: any) => ({ ...prev, emergency_procedures: { ...prev.emergency_procedures, procedures: procs } }));
                  }} placeholder="Contact name" placeholderTextColor={Colors.grayInactive} />
                  <TextInput style={[styles.input, { flex: 1 }]} value={proc.contact_phone} onChangeText={v => {
                    const procs = [...(config.emergency_procedures?.procedures || DEFAULT_PROCEDURES)];
                    procs[i] = { ...procs[i], contact_phone: v };
                    setConfig((prev: any) => ({ ...prev, emergency_procedures: { ...prev.emergency_procedures, procedures: procs } }));
                  }} placeholder="Contact phone" keyboardType="phone-pad" placeholderTextColor={Colors.grayInactive} />
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.saveBtn} onPress={() => {
              setSaving(true);
              api.put('/company-config/emergency-procedures', {
                procedures: config.emergency_procedures?.procedures || DEFAULT_PROCEDURES
              }).then(() => { Alert.alert('Saved', 'Emergency procedures updated'); setSaving(false); })
                .catch(() => { Alert.alert('Error', 'Failed to save'); setSaving(false); });
            }} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.saveBtnText}>Save Procedures</Text></>}
            </TouchableOpacity>
          </View>
        )}

        {/* Communication */}
        {activeSection === 'communication' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}><Ionicons name="chatbubbles" size={20} color={Colors.secondary} /><Text style={styles.sectionTitle}>Communication Preferences</Text></View>
            <Text style={styles.sectionHint}>How guests and providers should reach you.</Text>
            <Field section="communication" field="preferred_contact_method" label="Preferred Contact Method" placeholder="text / call / email / app" />
            <Field section="communication" field="response_time_sla" label="Response Time SLA" placeholder="Within 1 hour during business hours" />
            <Field section="communication" field="escalation_chain" label="Escalation Chain" placeholder="1) Text manager 2) Call office 3) Call emergency line" multiline />
            <Field section="communication" field="guest_welcome_message" label="Guest Welcome Message" placeholder="Welcome to our property! We're so glad you chose us..." multiline />
            <Field section="communication" field="guest_checkout_message" label="Guest Checkout Message" placeholder="Thank you for staying with us! We hope you enjoyed..." multiline />
            <Field section="communication" field="provider_welcome_message" label="Provider Welcome Message" placeholder="Thank you for being part of our team! Here's how to get started..." multiline />
            <SaveBtn section="communication" endpoint="communication" />
          </View>
        )}

        {/* Legal */}
        {activeSection === 'legal' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}><Ionicons name="shield-checkmark" size={20} color={Colors.accent} /><Text style={styles.sectionTitle}>Legal & Policies</Text></View>
            <Text style={styles.sectionHint}>Cancellation, damage, and liability policies.</Text>
            <Field section="legal" field="cancellation_policy" label="Cancellation Policy" placeholder="Full refund if cancelled 48+ hours before check-in..." multiline />
            <Field section="legal" field="damage_policy" label="Damage Policy" placeholder="A $500 security deposit is required. Damages beyond normal wear..." multiline />
            <Field section="legal" field="liability_waiver" label="Liability Waiver" placeholder="Guests assume responsibility for..." multiline />
            <Field section="legal" field="terms_of_service_url" label="Terms of Service URL" placeholder="https://yoursite.com/terms" />
            <Field section="legal" field="privacy_policy_url" label="Privacy Policy URL" placeholder="https://yoursite.com/privacy" />
            <SaveBtn section="legal" endpoint="legal" />
          </View>
        )}

        {/* Custom FAQs */}
        {activeSection === 'faqs' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}><Ionicons name="help-circle" size={20} color="#607D8B" /><Text style={styles.sectionTitle}>Custom FAQs</Text></View>
            <Text style={styles.sectionHint}>Add your own questions and answers. These appear in the Help Center and AI knows them too.</Text>
            {(config.custom_faqs?.faqs || []).map((faq: any, i: number) => (
              <View key={i} style={styles.faqCard}>
                <View style={styles.faqHeader}>
                  <Text style={styles.faqNum}>Q{i + 1}</Text>
                  <TouchableOpacity onPress={() => {
                    const faqs = [...(config.custom_faqs?.faqs || [])];
                    faqs.splice(i, 1);
                    setConfig((prev: any) => ({ ...prev, custom_faqs: { ...prev.custom_faqs, faqs } }));
                  }}><Ionicons name="trash" size={16} color={Colors.redUrgent} /></TouchableOpacity>
                </View>
                <TextInput style={styles.input} value={faq.question} onChangeText={v => {
                  const faqs = [...(config.custom_faqs?.faqs || [])];
                  faqs[i] = { ...faqs[i], question: v };
                  setConfig((prev: any) => ({ ...prev, custom_faqs: { ...prev.custom_faqs, faqs } }));
                }} placeholder="Question..." placeholderTextColor={Colors.grayInactive} />
                <TextInput style={[styles.input, { height: 60 }]} value={faq.answer} onChangeText={v => {
                  const faqs = [...(config.custom_faqs?.faqs || [])];
                  faqs[i] = { ...faqs[i], answer: v };
                  setConfig((prev: any) => ({ ...prev, custom_faqs: { ...prev.custom_faqs, faqs } }));
                }} placeholder="Answer..." placeholderTextColor={Colors.grayInactive} multiline />
                <View style={styles.faqRoleRow}>
                  {['all', 'admin', 'provider', 'guest'].map(r => (
                    <TouchableOpacity key={r} style={[styles.faqRoleBtn, faq.role === r && styles.faqRoleBtnActive]} onPress={() => {
                      const faqs = [...(config.custom_faqs?.faqs || [])];
                      faqs[i] = { ...faqs[i], role: r };
                      setConfig((prev: any) => ({ ...prev, custom_faqs: { ...prev.custom_faqs, faqs } }));
                    }}>
                      <Text style={[styles.faqRoleText, faq.role === r && { color: '#fff' }]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addFaqBtn} onPress={() => {
              const faqs = [...(config.custom_faqs?.faqs || []), { question: '', answer: '', role: 'all', order: 0 }];
              setConfig((prev: any) => ({ ...prev, custom_faqs: { ...prev.custom_faqs, faqs } }));
            }}>
              <Ionicons name="add-circle" size={20} color={Colors.primary} />
              <Text style={styles.addFaqText}>Add FAQ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={() => {
              setSaving(true);
              api.put('/company-config/custom-faqs', { faqs: config.custom_faqs?.faqs || [] })
                .then(() => { Alert.alert('Saved', 'Custom FAQs updated'); setSaving(false); })
                .catch(() => { Alert.alert('Error', 'Failed to save'); setSaving(false); });
            }} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.saveBtnText}>Save FAQs</Text></>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  tabScroll: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 6 },
  sTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  sTabText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  content: { padding: Spacing.md, paddingBottom: 40 },
  section: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.md, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  sectionHint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16, marginBottom: 4 },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  input: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  toggleSub: { fontSize: 11, color: Colors.textSecondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary, marginTop: Spacing.sm },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  procCard: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, padding: Spacing.sm, gap: 6, borderWidth: 1, borderColor: Colors.redUrgent + '20' },
  procHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  procTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  procRow: { flexDirection: 'row', gap: Spacing.sm },
  faqCard: { backgroundColor: Colors.surfaceSecondary, borderRadius: 10, padding: Spacing.sm, gap: 6, borderWidth: 1, borderColor: Colors.border },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqNum: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  faqRoleRow: { flexDirection: 'row', gap: 4 },
  faqRoleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  faqRoleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  faqRoleText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  addFaqBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  addFaqText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
});
