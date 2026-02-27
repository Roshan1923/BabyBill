/* eslint-disable react-native/no-inline-styles */
import React, { useState } from 'react';
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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useProcessing } from '../context/ProcessingContext';

const DS = {
  bgPage:        '#FAF8F4',
  bgSurface:     '#FFFEFB',
  bgSurface2:    '#F5F2EC',
  brandNavy:     '#1A3A6B',
  accentGold:    '#E8A020',
  accentGoldSub: '#FEF3DC',
  textPrimary:   '#1C1610',
  textSecondary: '#8A7E72',
  textInverse:   '#FFFEFB',
  positive:      '#2A8C5C',
  positiveSub:   '#E8F5EE',
  negative:      '#C8402A',
  border:        '#EDE8E0',
  shadow:        'rgba(26,58,107,0.10)',
  pagePad:       20,
};

export default function ReviewReceiptScreen({ route, navigation }) {
  const { jobId, receipt } = route.params;
  const { markReviewed } = useProcessing();

  // Editable fields
  const [storeName, setStoreName] = useState(receipt?.store_name || '');
  const [date, setDate] = useState(receipt?.date || '');
  const [total, setTotal] = useState(String(receipt?.total_amount || '0.00'));
  const [subtotal, setSubtotal] = useState(String(receipt?.subtotal || '0.00'));
  const [tax, setTax] = useState(String(receipt?.tax || '0.00'));
  const [category, setCategory] = useState(receipt?.category || 'Other');
  const [paymentMethod, setPaymentMethod] = useState(receipt?.payment_method || 'Unknown');

  const items = receipt?.items || [];

  const CATEGORIES = ['Food', 'Bills', 'Gas', 'Shopping', 'Medical', 'Other'];
  const PAYMENTS = ['Cash', 'Credit Card', 'Debit Card', 'Unknown'];

  const handleSave = () => {
    // Mark as reviewed in ProcessingContext — moves out of To Review
    markReviewed(jobId);

    // TODO: If user edited fields, update in Supabase
    // For now, the receipt is already saved by the backend

    navigation.navigate('Receipts', { tab: 'saved' });
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard Receipt?',
      'This receipt will be removed and not saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            markReviewed(jobId); // Remove from To Review
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={DS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Receipt</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Store & Date Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Store</Text>
            <TextInput
              style={styles.cardInput}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="Store name"
              placeholderTextColor={DS.textSecondary}
            />

            <View style={styles.divider} />

            <Text style={styles.cardLabel}>Date</Text>
            <TextInput
              style={styles.cardInput}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={DS.textSecondary}
            />
          </View>

          {/* Amounts Card */}
          <View style={styles.card}>
            <View style={styles.amountRow}>
              <View style={styles.amountCol}>
                <Text style={styles.cardLabel}>Subtotal</Text>
                <View style={styles.amountInput}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    style={styles.amountField}
                    value={subtotal}
                    onChangeText={setSubtotal}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={DS.textSecondary}
                  />
                </View>
              </View>
              <View style={styles.amountCol}>
                <Text style={styles.cardLabel}>Tax</Text>
                <View style={styles.amountInput}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    style={styles.amountField}
                    value={tax}
                    onChangeText={setTax}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={DS.textSecondary}
                  />
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <View style={styles.totalInput}>
                <Text style={styles.totalDollar}>$</Text>
                <TextInput
                  style={styles.totalField}
                  value={total}
                  onChangeText={setTotal}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={DS.textSecondary}
                />
              </View>
            </View>
          </View>

          {/* Category & Payment */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Category</Text>
            <View style={styles.pillRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.pill, category === cat && styles.pillActive]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            <Text style={styles.cardLabel}>Payment</Text>
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

          {/* Items Card */}
          {items.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>
                Items ({items.length})
              </Text>
              {items.map((item, i) => (
                <View key={i} style={styles.itemRow}>
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name || 'Item'}
                    </Text>
                    {item.quantity > 1 && (
                      <Text style={styles.itemQty}>×{item.quantity}</Text>
                    )}
                  </View>
                  <Text style={styles.itemPrice}>
                    ${parseFloat(item.price || 0).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Bottom spacer */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom buttons */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.discardBtn}
            onPress={handleDiscard}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color={DS.negative} />
            <Text style={styles.discardText}>Discard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={18} color={DS.textInverse} />
            <Text style={styles.saveText}>Save Receipt</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.pagePad,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DS.textPrimary,
  },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: DS.pagePad, paddingTop: 8 },

  // Cards
  card: {
    backgroundColor: DS.bgSurface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: DS.border,
    ...Platform.select({
      ios: {
        shadowColor: DS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardInput: {
    fontSize: 16,
    fontWeight: '600',
    color: DS.textPrimary,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderBottomWidth: 0,
  },
  divider: {
    height: 1,
    backgroundColor: DS.border,
    marginVertical: 12,
  },

  // Amounts
  amountRow: {
    flexDirection: 'row',
    gap: 16,
  },
  amountCol: { flex: 1 },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dollarSign: {
    fontSize: 16,
    fontWeight: '600',
    color: DS.textSecondary,
    marginRight: 4,
  },
  amountField: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: DS.textPrimary,
    paddingVertical: 8,
  },

  // Total
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: DS.textPrimary,
  },
  totalInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.accentGoldSub,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  totalDollar: {
    fontSize: 18,
    fontWeight: '700',
    color: DS.accentGold,
    marginRight: 2,
  },
  totalField: {
    fontSize: 18,
    fontWeight: '700',
    color: DS.accentGold,
    minWidth: 60,
    paddingVertical: 0,
  },

  // Pills
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: DS.bgSurface2,
    borderWidth: 1,
    borderColor: DS.border,
  },
  pillActive: {
    backgroundColor: DS.brandNavy,
    borderColor: DS.brandNavy,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.textSecondary,
  },
  pillTextActive: {
    color: DS.textInverse,
  },

  // Items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: DS.textPrimary,
    flex: 1,
  },
  itemQty: {
    fontSize: 12,
    fontWeight: '500',
    color: DS.textSecondary,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.textPrimary,
    marginLeft: 12,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: DS.pagePad,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: DS.bgPage,
    borderTopWidth: 1,
    borderTopColor: DS.border,
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: DS.bgSurface,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 64, 42, 0.2)',
  },
  discardText: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.negative,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: DS.positive,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(42, 140, 92, 0.3)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: DS.textInverse,
  },
});