import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, TextInput, Modal, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import api from '../src/utils/api';

export default function InventoryScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [categories, setCategories] = useState<any[]>([]);
  const [adjustModal, setAdjustModal] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustAction, setAdjustAction] = useState<'add' | 'remove'>('remove');
  const [qrModal, setQrModal] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const isAdmin = user?.role === 'property_manager' || user?.role === 'super_admin';

  const fetchItems = async () => {
    try {
      const params: any = {};
      if (filter === 'low_stock') params.low_stock = true;
      if (catFilter !== 'all') params.category = catFilter;
      const { data } = await api.get('/inventory-v2/items', { params });
      setItems(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/inventory-v2/categories');
      setCategories(data);
    } catch {}
  };

  useEffect(() => { setLoading(true); fetchItems(); fetchCategories(); }, [filter, catFilter]);

  const handleAdjust = async () => {
    if (!adjustModal) return;
    const qty = parseInt(adjustQty) || 0;
    if (qty <= 0) { Alert.alert('Invalid', 'Enter a quantity greater than 0'); return; }
    try {
      const change = adjustAction === 'add' ? qty : -qty;
      const { data } = await api.post('/inventory-v2/adjust', { item_id: adjustModal.id, quantity: change, reason: `Manual ${adjustAction}` });
      Alert.alert('Updated', `${adjustModal.name}: ${data.previous_qty} → ${data.new_qty}`);
      setAdjustModal(null);
      setAdjustQty('1');
      fetchItems();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to adjust');
    }
  };

  const showQR = async (item: any) => {
    setQrLoading(true);
    setQrModal(item);
    try {
      const { data } = await api.get(`/inventory-v2/items/${item.id}/qr`);
      setQrModal({ ...item, qr_base64: data.qr_code_base64 });
    } catch {}
    finally { setQrLoading(false); }
  };

  const catColors: Record<string, string> = {
    cleaning: Colors.secondary, pool_chemicals: Colors.blueAssigned, outdoor: Colors.greenReady,
    batteries: Colors.accent, linens: Colors.purpleAwaiting, toiletries: '#E879A0',
    maintenance: Colors.primary, general: Colors.grayInactive,
  };
  const catIcons: Record<string, string> = {
    cleaning: 'sparkles', pool_chemicals: 'water', outdoor: 'leaf',
    batteries: 'battery-charging', linens: 'shirt', toiletries: 'water',
    maintenance: 'construct', general: 'cube',
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Stock/Low Stock filter */}
      <View style={styles.topFilters}>
        {['all', 'low_stock'].map(f => (
          <TouchableOpacity key={f} testID={`filter-${f}`} style={[styles.pill, filter === f && styles.pillActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>{f === 'all' ? 'All Items' : 'Low Stock'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category chips */}
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={[{ category: 'all', count: items.length }, ...categories]} keyExtractor={c => c.category} contentContainerStyle={styles.catRow}
        renderItem={({ item: c }) => (
          <TouchableOpacity testID={`cat-${c.category}`} style={[styles.catChip, catFilter === c.category && { backgroundColor: catColors[c.category] || Colors.primary, borderColor: catColors[c.category] || Colors.primary }]} onPress={() => setCatFilter(c.category)}>
            {c.category !== 'all' && <Ionicons name={(catIcons[c.category] || 'cube') as any} size={13} color={catFilter === c.category ? '#fff' : Colors.textSecondary} />}
            <Text style={[styles.catText, catFilter === c.category && { color: '#fff' }]}>{c.category === 'all' ? 'All' : c.category.replace(/_/g, ' ')}</Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={fetchItems} tintColor={Colors.primary} />}
        renderItem={({ item }) => {
          const color = catColors[item.category] || Colors.grayInactive;
          return (
            <View testID={`inv-item-${item.id}`} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.catIcon, { backgroundColor: color + '18' }]}>
                  <Ionicons name={(catIcons[item.category] || 'cube') as any} size={20} color={color} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSku}>{item.sku} · {item.unit_type}</Text>
                </View>
                {item.is_low_stock && <View style={styles.lowBadge}><Ionicons name="warning" size={13} color={Colors.redUrgent} /><Text style={styles.lowText}>Low</Text></View>}
              </View>

              {/* Location & Storage */}
              <View style={styles.locationRow}>
                <Ionicons name="location" size={13} color={Colors.textSecondary} />
                <Text style={styles.locationText}>{item.location || 'No location'}</Text>
                {item.storage_area ? <><Ionicons name="cube-outline" size={13} color={Colors.textSecondary} /><Text style={styles.locationText}>{item.storage_area}</Text></> : null}
              </View>
              {item.property_name ? <Text style={styles.propName}>{item.property_name}</Text> : null}

              {/* Quantities */}
              <View style={styles.qtyRow}>
                <View style={styles.qtyBox}>
                  <Text style={[styles.qtyNum, item.is_low_stock && { color: Colors.redUrgent }]}>{item.quantity_on_hand}</Text>
                  <Text style={styles.qtyLabel}>On Hand</Text>
                </View>
                <View style={styles.qtyDivider} />
                <View style={styles.qtyBox}>
                  <Text style={styles.qtyNum}>{item.par_level}</Text>
                  <Text style={styles.qtyLabel}>Par</Text>
                </View>
                <View style={styles.qtyDivider} />
                <View style={styles.qtyBox}>
                  <Text style={styles.qtyNum}>{item.reorder_level}</Text>
                  <Text style={styles.qtyLabel}>Reorder</Text>
                </View>
              </View>

              {/* Stock bar */}
              <View style={styles.stockBar}>
                <View style={[styles.stockFill, { width: `${Math.min(100, (item.quantity_on_hand / Math.max(item.par_level, 1)) * 100)}%`, backgroundColor: item.is_low_stock ? Colors.redUrgent : Colors.greenReady }]} />
              </View>

              {/* Action buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity testID={`remove-${item.id}`} style={[styles.actionBtn, { backgroundColor: Colors.redUrgent + '12' }]} onPress={() => { setAdjustModal(item); setAdjustAction('remove'); setAdjustQty('1'); }}>
                  <Ionicons name="remove-circle" size={16} color={Colors.redUrgent} />
                  <Text style={[styles.actionText, { color: Colors.redUrgent }]}>Remove</Text>
                </TouchableOpacity>
                {(isAdmin || item.allow_user_add) && (
                  <TouchableOpacity testID={`add-${item.id}`} style={[styles.actionBtn, { backgroundColor: Colors.greenReady + '12' }]} onPress={() => { setAdjustModal(item); setAdjustAction('add'); setAdjustQty('1'); }}>
                    <Ionicons name="add-circle" size={16} color={Colors.greenReady} />
                    <Text style={[styles.actionText, { color: Colors.greenReady }]}>Add</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity testID={`qr-${item.id}`} style={[styles.actionBtn, { backgroundColor: Colors.primary + '12' }]} onPress={() => showQR(item)}>
                  <Ionicons name="qr-code" size={16} color={Colors.primary} />
                  <Text style={[styles.actionText, { color: Colors.primary }]}>QR</Text>
                </TouchableOpacity>
              </View>

              {item.allow_user_add && <View style={styles.userAddBadge}><Ionicons name="person-add" size={11} color={Colors.secondary} /><Text style={styles.userAddText}>Users can add stock</Text></View>}

              {/* Reorder button - shows when low stock */}
              {item.is_low_stock && (
                <TouchableOpacity 
                  style={styles.reorderBtn} 
                  onPress={() => {
                    if (item.reorder_url) {
                      Linking.openURL(item.reorder_url);
                    } else {
                      Alert.alert('Set Reorder Link', 'No vendor link set for this item. Add an Amazon or vendor URL in item settings.', [
                        { text: 'Cancel' },
                        { text: 'Set URL', onPress: () => {
                          Alert.prompt?.('Reorder URL', 'Enter vendor link (e.g., Amazon URL)', async (url: string) => {
                            if (url) {
                              try {
                                await api.put(`/inventory-v2/items/${item.id}/reorder-settings`, { reorder_url: url });
                                fetchItems();
                              } catch {}
                            }
                          }) || Alert.alert('Info', 'Use admin settings to add vendor reorder links');
                        }},
                      ]);
                    }
                  }}
                >
                  <Ionicons name="cart" size={16} color="#fff" />
                  <Text style={styles.reorderBtnText}>{item.reorder_url ? 'Reorder from Vendor' : 'Set Reorder Link'}</Text>
                  {item.reorder_url && <Ionicons name="open-outline" size={14} color="#fff" />}
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="cube-outline" size={48} color={Colors.grayInactive} /><Text style={styles.emptyText}>No items found</Text></View>}
      />

      {/* Adjust Quantity Modal */}
      <Modal visible={!!adjustModal} transparent animationType="fade" onRequestClose={() => setAdjustModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{adjustAction === 'add' ? 'Add Stock' : 'Remove Stock'}</Text>
            <Text style={styles.modalItem}>{adjustModal?.name}</Text>
            <Text style={styles.modalCurrent}>Current: {adjustModal?.quantity_on_hand} {adjustModal?.unit_type}</Text>
            <View style={styles.qtyInputRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setAdjustQty(String(Math.max(1, (parseInt(adjustQty) || 1) - 1)))}>
                <Ionicons name="remove" size={24} color={Colors.primary} />
              </TouchableOpacity>
              <TextInput testID="qty-input" style={styles.qtyInput} value={adjustQty} onChangeText={setAdjustQty} keyboardType="numeric" />
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setAdjustQty(String((parseInt(adjustQty) || 0) + 1))}>
                <Ionicons name="add" size={24} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setAdjustModal(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="confirm-adjust" style={[styles.modalConfirm, { backgroundColor: adjustAction === 'add' ? Colors.greenReady : Colors.redUrgent }]} onPress={handleAdjust}>
                <Text style={styles.modalConfirmText}>{adjustAction === 'add' ? 'Add' : 'Remove'} {adjustQty}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code Modal - Fold & Hang Label Design */}
      <Modal visible={!!qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, styles.qrModalContent]}>
            {/* Fold instructions (upside down on print) */}
            <View style={styles.foldInstructions}>
              <Ionicons name="cut-outline" size={14} color={Colors.grayInactive} />
              <Text style={styles.foldLine}>- - - - FOLD HERE - then hang on box - - - -</Text>
              <Ionicons name="cut-outline" size={14} color={Colors.grayInactive} />
            </View>

            {/* The Label Card */}
            <View style={styles.labelCard}>
              {/* Category header */}
              <Text style={styles.labelCategory}>INVENTORY CODE</Text>

              {/* Big identifier */}
              <Text style={styles.labelId}>{qrModal?.sku || 'N/A'}</Text>

              {/* QR Code */}
              {qrLoading ? (
                <ActivityIndicator size="large" color={Colors.primaryForeground} style={{ marginVertical: 20 }} />
              ) : qrModal?.qr_base64 ? (
                <View style={styles.qrContainer}>
                  <Image source={{ uri: `data:image/png;base64,${qrModal.qr_base64}` }} style={styles.qrImage} resizeMode="contain" />
                </View>
              ) : null}

              {/* Scan instruction */}
              <Text style={styles.labelScan}>Scan to find in Property Pulse AI</Text>

              {/* Divider */}
              <View style={styles.labelDivider} />

              {/* Item details */}
              <Text style={styles.labelItemName}>{qrModal?.name}</Text>
              <Text style={styles.labelItemDetail}>{qrModal?.category || 'General'}</Text>

              {/* Location badge */}
              <View style={styles.labelLocationBadge}>
                <Text style={styles.labelLocationText}>{qrModal?.location}{qrModal?.storage_area ? ` > ${qrModal.storage_area}` : ''}</Text>
              </View>

              {/* Property name */}
              {qrModal?.property_name && (
                <Text style={styles.labelProp}>{qrModal.property_name}</Text>
              )}

              {/* Brand footer */}
              <Text style={styles.labelBrand}>PROPERTY PULSE AI</Text>
            </View>

            <Text style={styles.foldHint}>Print, fold in half, and hang on storage box</Text>

            <TouchableOpacity style={styles.qrCloseBtn} onPress={() => setQrModal(null)}>
              <Text style={styles.qrCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  topFilters: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: Spacing.sm },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  pillTextActive: { color: Colors.primaryForeground },
  catRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 6 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border },
  catText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 30 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  itemSku: { fontSize: 11, color: Colors.textSecondary },
  lowBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.redUrgent + '12', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  lowText: { fontSize: 11, fontWeight: '700', color: Colors.redUrgent },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  locationText: { fontSize: 12, color: Colors.textSecondary },
  propName: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBox: { flex: 1, alignItems: 'center' },
  qtyNum: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  qtyLabel: { fontSize: 10, color: Colors.textSecondary },
  qtyDivider: { width: 1, height: 28, backgroundColor: Colors.border },
  stockBar: { height: 5, backgroundColor: Colors.surfaceSecondary, borderRadius: 3 },
  stockFill: { height: 5, borderRadius: 3 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8 },
  actionText: { fontSize: 12, fontWeight: '700' },
  userAddBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  userAddText: { fontSize: 10, fontWeight: '600', color: Colors.secondary },
  reorderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.accent, paddingVertical: 8, borderRadius: 8, marginTop: 6 },
  reorderBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.lg, width: '100%', maxWidth: 360, gap: Spacing.sm },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  modalItem: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  modalCurrent: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  qtyInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  qtyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  qtyInput: { width: 80, height: 50, fontSize: 24, fontWeight: '800', textAlign: 'center', color: Colors.textPrimary, backgroundColor: Colors.surfaceSecondary, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  modalCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  modalConfirm: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // QR Modal - Fold & Hang Label
  qrModalContent: { alignItems: 'center', paddingHorizontal: Spacing.md },
  foldInstructions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  foldLine: { fontSize: 10, fontWeight: '700', color: Colors.grayInactive, letterSpacing: 1, textTransform: 'uppercase' },
  labelCard: { backgroundColor: '#1A2E3B', borderRadius: 14, padding: Spacing.md, width: '100%', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: '#2A4E5B' },
  labelCategory: { fontSize: 9, fontWeight: '700', color: Colors.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  labelId: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  qrContainer: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 6, marginVertical: 6 },
  qrImage: { width: 160, height: 160 },
  labelScan: { fontSize: 10, fontWeight: '600', color: '#7AA3B9', fontStyle: 'italic' },
  labelDivider: { height: 1, backgroundColor: '#3A5E6B', width: '80%', marginVertical: 6 },
  labelItemName: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  labelItemDetail: { fontSize: 12, color: '#7AA3B9', textTransform: 'capitalize' },
  labelLocationBadge: { backgroundColor: Colors.accent + '30', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  labelLocationText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  labelProp: { fontSize: 11, color: '#7AA3B9', marginTop: 2 },
  labelBrand: { fontSize: 8, fontWeight: '700', color: '#4A6E7B', letterSpacing: 2, marginTop: 6 },
  foldHint: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: Spacing.sm },
  qrCloseBtn: { backgroundColor: Colors.primary, paddingHorizontal: 40, paddingVertical: 12, borderRadius: 10, marginTop: Spacing.sm },
  qrCloseText: { fontSize: 15, fontWeight: '700', color: Colors.primaryForeground },
});
