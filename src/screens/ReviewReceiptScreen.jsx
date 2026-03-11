/* eslint-disable react-native/no-inline-styles */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  StatusBar,
  SafeAreaView,
  KeyboardAvoidingView,
  Alert,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useProcessing } from '../context/ProcessingContext';
import { supabase } from '../config/supabase';
import AddCategoryModal from '../components/AddCategoryModal';
import PaymentSection from '../components/PaymentSection';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DS = {
  bgPage:        '#FAF8F4',
  bgSurface:     '#FFFEFB',
  bgSurface2:    '#F5F2EC',
  brandNavy:     '#1A3A6B',
  brandBlue:     '#2563C8',
  accentGold:    '#E8A020',
  accentGoldSub: '#FEF3DC',
  textPrimary:   '#1C1610',
  textSecondary: '#8A7E72',
  textInverse:   '#FFFEFB',
  positive:      '#2A8C5C',
  positiveSub:   '#E8F5EE',
  negative:      '#C8402A',
  negativeSub:   '#FDF2EF',
  border:        '#EDE8E0',
  shadow:        'rgba(26,58,107,0.10)',
  pagePad:       20,
};

const FALLBACK_ICON = 'receipt-outline';
const FALLBACK_COLOR = '#8A7E72';

// ─── Editable Item Row ───────────────────────────────────────

function ItemRow({ item, index, onUpdate, onRemove }) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemMain}>
        <TextInput
          style={styles.itemNameInput}
          value={item.name}
          onChangeText={(val) => onUpdate(index, 'name', val)}
          placeholder="Item name"
          placeholderTextColor={DS.textSecondary}
        />
        <View style={styles.itemMeta}>
          <View style={styles.qtyWrap}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => {
                const q = Math.max(1, (item.quantity || 1) - 1);
                onUpdate(index, 'quantity', q);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={14} color={DS.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{item.quantity || 1}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => onUpdate(index, 'quantity', (item.quantity || 1) + 1)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={14} color={DS.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.itemPriceWrap}>
            <Text style={styles.itemDollar}>$</Text>
            <TextInput
              style={styles.itemPriceInput}
              value={String(item.price || '0.00')}
              onChangeText={(val) => onUpdate(index, 'price', val)}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={DS.textSecondary}
            />
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(index)} activeOpacity={0.7}>
        <Ionicons name="close-circle" size={22} color={DS.negative} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function ReviewReceiptScreen({ route, navigation }) {
  const { jobId, receipt } = route.params;
  const { markReviewed } = useProcessing();

  // Editable fields
  const [storeName, setStoreName] = useState(receipt?.store_name || '');
  const [date, setDate] = useState(receipt?.date || '');
  const [total, setTotal] = useState(String(receipt?.total_amount || '0.00'));
  const [subtotal, setSubtotal] = useState(String(receipt?.subtotal || '0.00'));
  const [tax, setTax] = useState(String(receipt?.tax || '0.00'));
  const [discount, setDiscount] = useState(String(receipt?.discount || '0.00'));
  const [category, setCategory] = useState(receipt?.category || 'Other');
  const [paymentMethod, setPaymentMethod] = useState(receipt?.payment_method || 'Unknown');
  const [items, setItems] = useState(
    (receipt?.items || []).map((it, i) => ({
      ...it,
      _key: `item_${i}_${Date.now()}`,
    }))
  );
  const [saving, setSaving] = useState(false);

  // Dynamic categories
  const [userCategories, setUserCategories] = useState([]);
  const [addCatModalVisible, setAddCatModalVisible] = useState(false);

  const PAYMENTS = ['Cash', 'Credit Card', 'Debit Card', 'Unknown'];

  // Fetch categories on focus
  const fetchCategories = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('user_categories')
        .select('name, icon, color')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (!error && data) setUserCategories(data);
    } catch (err) {
      console.log('Error fetching categories:', err);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchCategories(); }, [fetchCategories]));

  const handleCategoryAdded = (newCat) => {
    setUserCategories((prev) => [...prev, newCat]);
    setCategory(newCat.name);
  };

  // ── Item CRUD ──

  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeItem = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems((prev) => [
      ...prev,
      { name: '', price: '0.00', quantity: 1, _key: `item_new_${Date.now()}` },
    ]);
  };

  // ── Save ──

  const handleSave = async () => {
    setSaving(true);
    try {
      if (receipt?.id) {
        const cleanItems = items.map(({ _key, ...rest }) => rest);
        const { error } = await supabase
          .from('receipts')
          .update({
            store_name: storeName,
            date: date,
            total_amount: total,
            subtotal: subtotal,
            tax: tax,
            discount: discount,
            category: category,
            payment_method: paymentMethod,
            items: cleanItems,
          })
          .eq('id', receipt.id);

        if (error) {
          console.log('Update error:', error);
          Alert.alert('Error', 'Failed to save changes: ' + error.message);
          setSaving(false);
          return;
        }
      }

      markReviewed(jobId);
      navigation.navigate('Main', { screen: 'Receipts', params: { tab: 'saved' } });
    } catch (err) {
      Alert.alert('Error', 'Something went wrong: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard Receipt?',
      'This receipt has already been saved to your account. Discarding will delete it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (receipt?.id) {
              await supabase.from('receipts').delete().eq('id', receipt.id);
            }
            markReviewed(jobId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  // ── Render ──

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={DS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Review Receipt</Text>
            <Text style={styles.headerSubtitle}>Verify before saving</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Store & Date ── */}
          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabel}>
                <Ionicons name="storefront-outline" size={15} color={DS.textSecondary} />
                <Text style={styles.label}>Store</Text>
              </View>
              <TextInput
                style={styles.fieldInput}
                value={storeName}
                onChangeText={setStoreName}
                placeholder="Store name"
                placeholderTextColor="#C5BEB5"
              />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabel}>
                <Ionicons name="calendar-outline" size={15} color={DS.textSecondary} />
                <Text style={styles.label}>Date</Text>
              </View>
              <TextInput
                style={styles.fieldInput}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#C5BEB5"
              />
            </View>
          </View>

          {/* ── Amounts ── */}
          <View style={styles.card}>
            <View style={styles.amountsGrid}>
              <View style={styles.amountCell}>
                <Text style={styles.amountLabel}>Subtotal</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.dollar}>$</Text>
                  <TextInput style={styles.amountInput} value={subtotal} onChangeText={setSubtotal} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#C5BEB5" />
                </View>
              </View>
              <View style={styles.amountCell}>
                <Text style={styles.amountLabel}>Tax</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.dollar}>$</Text>
                  <TextInput style={styles.amountInput} value={tax} onChangeText={setTax} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#C5BEB5" />
                </View>
              </View>
              <View style={styles.amountCell}>
                <Text style={styles.amountLabel}>Discount</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.dollar}>$</Text>
                  <TextInput style={styles.amountInput} value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#C5BEB5" />
                </View>
              </View>
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.totalBanner}>
              <Text style={styles.totalBannerLabel}>Total</Text>
              <View style={styles.totalBannerInput}>
                <Text style={styles.totalDollar}>$</Text>
                <TextInput style={styles.totalField} value={total} onChangeText={setTotal} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="rgba(232,160,32,0.5)" />
              </View>
            </View>
          </View>

          {/* ── Category (dynamic chips) ── */}
          <View style={styles.card}>
            <View style={styles.fieldLabel}>
              <Ionicons name="pricetag-outline" size={15} color={DS.textSecondary} />
              <Text style={styles.label}>Category</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChipsRow}
              style={{ marginTop: 6, marginBottom: 2 }}
            >
              {userCategories.map((cat) => {
                const isActive = category.toLowerCase() === cat.name.toLowerCase();
                const catColor = cat.color || FALLBACK_COLOR;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[
                      styles.categoryChip,
                      isActive
                        ? { backgroundColor: catColor + '20', borderColor: catColor }
                        : { backgroundColor: DS.bgSurface2, borderColor: DS.border },
                    ]}
                    onPress={() => setCategory(cat.name)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={cat.icon || FALLBACK_ICON}
                      size={14}
                      color={isActive ? catColor : DS.textSecondary}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: isActive ? catColor : DS.textSecondary },
                        isActive && { fontWeight: '700' },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* + New chip */}
              <TouchableOpacity
                style={styles.addCategoryChip}
                onPress={() => setAddCatModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color={DS.brandBlue} />
                <Text style={styles.addCategoryChipText}>New</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.fieldDivider} />

            <View style={styles.fieldLabel}>
              <Ionicons name="card-outline" size={15} color={DS.textSecondary} />
              <Text style={styles.label}>Payment Method</Text>
            </View>
            <View style={styles.pillRow}>
              {PAYMENTS.map((pm) => (
                <TouchableOpacity
                  key={pm}
                  style={[styles.pill, paymentMethod === pm && styles.pillActive]}
                  onPress={() => setPaymentMethod(pm)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, paymentMethod === pm && styles.pillTextActive]}>
                    {pm}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Items ── */}
          {/* ── Payment Card (linked cards) ── */}
          {receipt?.id && (
            <PaymentSection
              receiptId={receipt.id}
              editing={true}
              navigation={navigation}
              legacyPaymentMethod={paymentMethod}
            />
          )}
          <View style={styles.card}>
            <View style={styles.itemsHeader}>
              <View style={styles.fieldLabel}>
                <Ionicons name="receipt-outline" size={15} color={DS.textSecondary} />
                <Text style={styles.label}>Items ({items.length})</Text>
              </View>
              <TouchableOpacity style={styles.addItemBtn} onPress={addItem} activeOpacity={0.7}>
                <Ionicons name="add-circle" size={20} color={DS.positive} />
                <Text style={styles.addItemText}>Add</Text>
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <View style={styles.noItems}>
                <Text style={styles.noItemsText}>No items found</Text>
                <TouchableOpacity onPress={addItem} activeOpacity={0.7}>
                  <Text style={styles.noItemsAdd}>+ Add an item</Text>
                </TouchableOpacity>
              </View>
            ) : (
              items.map((item, i) => (
                <ItemRow key={item._key} item={item} index={i} onUpdate={updateItem} onRemove={removeItem} />
              ))
            )}
          </View>

          <View style={{ height: 110 }} />
        </ScrollView>

        {/* ── Bottom Bar ── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={18} color={DS.negative} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            activeOpacity={0.8}
            disabled={saving}
          >
            <Ionicons name="checkmark-circle" size={20} color={DS.textInverse} />
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Receipt'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Add Category Modal (inline) ── */}
      <AddCategoryModal
        visible={addCatModalVisible}
        onClose={() => setAddCatModalVisible(false)}
        existingNames={userCategories.map((c) => c.name)}
        onCategoryAdded={handleCategoryAdded}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: DS.pagePad,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 4 : 4,
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: DS.border, backgroundColor: DS.bgPage,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: DS.bgSurface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: DS.border,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: DS.textPrimary },
  headerSubtitle: { fontSize: 12, fontWeight: '500', color: DS.textSecondary, marginTop: 1 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: DS.pagePad, paddingTop: 14 },

  card: {
    backgroundColor: DS.bgSurface, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.8, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },

  fieldGroup: { marginBottom: 2 },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '600', color: DS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldInput: { fontSize: 17, fontWeight: '600', color: DS.textPrimary, paddingVertical: 8, paddingHorizontal: 0 },
  fieldDivider: { height: 1, backgroundColor: DS.border, marginVertical: 14 },

  amountsGrid: { flexDirection: 'row', gap: 12 },
  amountCell: { flex: 1 },
  amountLabel: { fontSize: 11, fontWeight: '600', color: DS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center' },
  dollar: { fontSize: 15, fontWeight: '600', color: DS.textSecondary, marginRight: 2 },
  amountInput: { flex: 1, fontSize: 16, fontWeight: '600', color: DS.textPrimary, paddingVertical: 6 },

  totalBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: DS.accentGoldSub, borderRadius: 12, padding: 14, marginTop: 2,
  },
  totalBannerLabel: { fontSize: 16, fontWeight: '700', color: DS.accentGold },
  totalBannerInput: { flexDirection: 'row', alignItems: 'center' },
  totalDollar: { fontSize: 22, fontWeight: '800', color: DS.accentGold, marginRight: 2 },
  totalField: { fontSize: 22, fontWeight: '800', color: DS.accentGold, minWidth: 70, paddingVertical: 0, textAlign: 'right' },

  // Category chips
  categoryChipsRow: { gap: 8, paddingRight: 4 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: 999, borderWidth: 1.5, gap: 6,
  },
  categoryChipText: { fontSize: 13, fontWeight: '600' },
  addCategoryChip: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: 999, borderWidth: 1.5, borderColor: DS.brandBlue, borderStyle: 'dashed',
    backgroundColor: DS.brandBlue + '08', gap: 4,
  },
  addCategoryChipText: { fontSize: 13, fontWeight: '600', color: DS.brandBlue },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 2 },
  pill: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: DS.bgSurface2, borderWidth: 1, borderColor: DS.border,
  },
  pillActive: { backgroundColor: DS.brandNavy, borderColor: DS.brandNavy },
  pillText: { fontSize: 13, fontWeight: '600', color: DS.textSecondary },
  pillTextActive: { color: DS.textInverse },

  itemsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: DS.positiveSub,
  },
  addItemText: { fontSize: 13, fontWeight: '600', color: DS.positive },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  itemMain: { flex: 1 },
  itemNameInput: {
    fontSize: 15, fontWeight: '600', color: DS.textPrimary,
    paddingVertical: 2, paddingHorizontal: 0, marginBottom: 6,
  },
  itemMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 0,
    borderRadius: 8, borderWidth: 1, borderColor: DS.border, overflow: 'hidden',
  },
  qtyBtn: { width: 30, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: DS.bgSurface2 },
  qtyText: { fontSize: 14, fontWeight: '700', color: DS.textPrimary, width: 28, textAlign: 'center' },
  itemPriceWrap: { flexDirection: 'row', alignItems: 'center' },
  itemDollar: { fontSize: 14, fontWeight: '600', color: DS.textSecondary, marginRight: 2 },
  itemPriceInput: { fontSize: 15, fontWeight: '600', color: DS.textPrimary, width: 65, textAlign: 'right', paddingVertical: 2 },
  removeBtn: { marginLeft: 10, padding: 4 },
  noItems: { alignItems: 'center', paddingVertical: 20 },
  noItemsText: { fontSize: 14, color: DS.textSecondary, marginBottom: 8 },
  noItemsAdd: { fontSize: 14, fontWeight: '600', color: DS.positive },

  bottomBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: DS.pagePad, paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: DS.bgPage, borderTopWidth: 1, borderTopColor: DS.border,
  },
  discardBtn: {
    width: 50, height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: DS.negativeSub, borderWidth: 1.5, borderColor: 'rgba(200,64,42,0.15)',
  },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 50, borderRadius: 14, backgroundColor: DS.positive,
    ...Platform.select({
      ios: { shadowColor: 'rgba(42,140,92,0.3)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  saveText: { fontSize: 16, fontWeight: '700', color: DS.textInverse },
});