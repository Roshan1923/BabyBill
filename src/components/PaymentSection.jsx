import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  Platform, ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '../config/supabase';

const DS = {
  bgPage: "#FAF8F4", bgSurface: "#FFFEFB", bgSurface2: "#F5F2EC",
  brandNavy: "#1A3A6B", brandBlue: "#2563C8", accentGold: "#E8A020",
  accentGoldSub: "#FEF3DC", textPrimary: "#1C1610", textSecondary: "#8A7E72",
  textMuted: "#B8B0A4", textInverse: "#FFFEFB", positive: "#2A8C5C",
  negative: "#C8402A", border: "#EDE8E0", shadow: "rgba(26,58,107,0.10)",
};

const NETWORK_LABEL = {
  visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex',
  interac: 'Interac', discover: 'Discover', rupay: 'RuPay',
};

const TYPE_ICON = {
  credit: 'card-outline', debit: 'card-outline', cash: 'cash-outline',
  gift_card: 'gift-outline', loyalty_points: 'star-outline',
  upi: 'phone-portrait-outline', e_transfer: 'swap-horizontal-outline',
  pad: 'repeat-outline', cheque: 'document-text-outline',
  paypal: 'logo-paypal', other: 'ellipsis-horizontal-outline',
};


// ═════════════════════════════════════════════════════════════
// LINKED CARD PILL (card is saved + matched)
// ═════════════════════════════════════════════════════════════

const LinkedCardPill = ({ card, payment, onPress }) => {
  const bgColor = card.color || DS.brandNavy;
  return (
    <TouchableOpacity activeOpacity={onPress ? 0.8 : 1} onPress={onPress} style={s.linkedPill}>
      <View style={[s.linkedDot, { backgroundColor: bgColor }]}>
        <Ionicons name="card" size={12} color="#fff" />
      </View>
      <View style={s.linkedInfo}>
        <Text style={s.linkedName}>{card.name}</Text>
        <Text style={s.linkedMeta}>
          {NETWORK_LABEL[card.network] || 'Card'} ····{card.last_four}
          {payment?.is_contactless ? '  ·  Tap' : ''}
        </Text>
      </View>
      {payment?.amount && (
        <Text style={s.linkedAmount}>${parseFloat(payment.amount).toFixed(2)}</Text>
      )}
    </TouchableOpacity>
  );
};


// ═════════════════════════════════════════════════════════════
// UNLINKED PAYMENT PILL (raw OCR data, no saved card)
// ═════════════════════════════════════════════════════════════

const UnlinkedPaymentPill = ({ payment, onSaveCard }) => {
  const icon = TYPE_ICON[payment.raw_type] || TYPE_ICON.other;
  const networkLabel = NETWORK_LABEL[payment.raw_network] || '';
  const typeLabel = payment.raw_type === 'credit' ? 'Credit' :
    payment.raw_type === 'debit' ? 'Debit' :
    payment.raw_type === 'cash' ? 'Cash' :
    payment.raw_type === 'gift_card' ? 'Gift Card' :
    payment.raw_type?.replace(/_/g, ' ') || 'Unknown';

  return (
    <View style={s.unlinkedWrap}>
      <View style={s.unlinkedPill}>
        <View style={s.unlinkedDot}>
          <Ionicons name={icon} size={13} color={DS.textSecondary} />
        </View>
        <View style={s.unlinkedInfo}>
          <Text style={s.unlinkedType}>
            {networkLabel ? `${networkLabel} · ${typeLabel}` : typeLabel}
          </Text>
          {payment.raw_last_four && (
            <Text style={s.unlinkedNum}>····{payment.raw_last_four}</Text>
          )}
        </View>
        {payment.is_contactless && (
          <View style={s.contactlessBadge}>
            <Ionicons name="wifi-outline" size={10} color={DS.brandBlue}
              style={{ transform: [{ rotate: '90deg' }] }} />
            <Text style={s.contactlessText}>Tap</Text>
          </View>
        )}
        {payment.amount && (
          <Text style={s.unlinkedAmount}>${parseFloat(payment.amount).toFixed(2)}</Text>
        )}
      </View>
      {/* Save card prompt — only for credit/debit with last four */}
      {payment.raw_last_four && ['credit', 'debit'].includes(payment.raw_type) && onSaveCard && (
        <TouchableOpacity activeOpacity={0.7} style={s.saveCardLink} onPress={() => onSaveCard(payment)}>
          <Ionicons name="add-circle-outline" size={14} color={DS.brandBlue} />
          <Text style={s.saveCardText}>Save this card</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};


// ═════════════════════════════════════════════════════════════
// CARD PICKER MODAL (for edit mode)
// ═════════════════════════════════════════════════════════════

const CardPickerModal = ({ visible, onClose, cards, selectedId, onSelect }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity activeOpacity={1} style={s.pickerOverlay} onPress={onClose}>
      <TouchableOpacity activeOpacity={1} style={s.pickerSheet} onPress={() => {}}>
        <View style={s.pickerHandle} />
        <Text style={s.pickerTitle}>Select Payment Card</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
          {/* None / Unknown option */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={[s.pickerRow, !selectedId && s.pickerRowActive]}
            onPress={() => { onSelect(null); onClose(); }}
          >
            <View style={[s.pickerDot, { backgroundColor: DS.bgSurface2 }]}>
              <Ionicons name="help-outline" size={14} color={DS.textSecondary} />
            </View>
            <Text style={s.pickerName}>Unknown / Not specified</Text>
            {!selectedId && <Ionicons name="checkmark-circle" size={20} color={DS.brandNavy} />}
          </TouchableOpacity>

          {/* Saved cards */}
          {cards.map((card) => {
            const active = selectedId === card.id;
            return (
              <TouchableOpacity
                key={card.id}
                activeOpacity={0.7}
                style={[s.pickerRow, active && s.pickerRowActive]}
                onPress={() => { onSelect(card); onClose(); }}
              >
                <View style={[s.pickerDot, { backgroundColor: card.color || DS.brandNavy }]}>
                  <Ionicons name="card" size={12} color="#fff" />
                </View>
                <View style={s.pickerInfo}>
                  <Text style={s.pickerName}>{card.name}</Text>
                  <Text style={s.pickerMeta}>
                    {NETWORK_LABEL[card.network] || 'Card'} ····{card.last_four}
                  </Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color={DS.brandNavy} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);


// ═════════════════════════════════════════════════════════════
// MAIN PAYMENT SECTION COMPONENT
// ═════════════════════════════════════════════════════════════

export default function PaymentSection({
  receiptId,
  editing = false,
  navigation,
  legacyPaymentMethod,  // fallback from receipts.payment_method
}) {
  const [payments, setPayments] = useState([]);
  const [savedCards, setSavedCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [editingPaymentIndex, setEditingPaymentIndex] = useState(null);

  // Fetch receipt_payments with joined payment_methods
  const fetchPayments = useCallback(async () => {
    if (!receiptId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('receipt_payments')
        .select('*, payment_methods(*)')
        .eq('receipt_id', receiptId)
        .order('line_index', { ascending: true });

      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  }, [receiptId]);

  // Fetch user's saved cards (for edit mode picker)
  const fetchSavedCards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .in('type', ['credit', 'debit'])
        .order('name', { ascending: true });
      setSavedCards(data || []);
    } catch (err) {
      console.error('Error fetching saved cards:', err);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchSavedCards();
  }, [fetchPayments, fetchSavedCards]);

  // Handle linking a payment to a saved card
  const handleSelectCard = async (card) => {
    if (editingPaymentIndex === null) return;
    const payment = payments[editingPaymentIndex];
    if (!payment) return;

    try {
      const { error } = await supabase
        .from('receipt_payments')
        .update({ payment_method_id: card ? card.id : null })
        .eq('id', payment.id);

      if (error) throw error;

      // Update local state
      setPayments(prev => prev.map((p, i) => {
        if (i === editingPaymentIndex) {
          return { ...p, payment_method_id: card?.id || null, payment_methods: card || null };
        }
        return p;
      }));
    } catch (err) {
      console.error('Error linking card:', err);
    }
    setEditingPaymentIndex(null);
  };

  // Navigate to add card screen with pre-filled data
  const handleSaveNewCard = (payment) => {
    if (!navigation) return;
    navigation.navigate('CardDetail', {
      prefill: {
        network: payment.raw_network || 'visa',
        last_four: payment.raw_last_four || '',
        type: payment.raw_type === 'debit' ? 'debit' : 'credit',
      },
    });
  };

  if (loading) {
    return (
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Ionicons name="card-outline" size={16} color={DS.textSecondary} />
          <Text style={s.sectionTitle}>Payment</Text>
        </View>
        <ActivityIndicator size="small" color={DS.brandNavy} style={{ paddingVertical: 12 }} />
      </View>
    );
  }

  // No payment data at all — show legacy or unknown
  if (payments.length === 0) {
    return (
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Ionicons name="card-outline" size={16} color={DS.textSecondary} />
          <Text style={s.sectionTitle}>Payment</Text>
        </View>
        <View style={s.unknownPill}>
          <Ionicons name="help-circle-outline" size={15} color={DS.textSecondary} />
          <Text style={s.unknownText}>
            {legacyPaymentMethod && legacyPaymentMethod !== 'Unknown'
              ? legacyPaymentMethod
              : 'No payment info detected'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Ionicons name="card-outline" size={16} color={DS.textSecondary} />
        <Text style={s.sectionTitle}>Payment</Text>
        {payments.length > 1 && (
          <View style={s.splitBadge}>
            <Text style={s.splitText}>Split · {payments.length} methods</Text>
          </View>
        )}
      </View>

      {payments.map((payment, index) => {
        const linkedCard = payment.payment_methods;

        if (linkedCard) {
          // ── Linked to saved card ──
          return (
            <View key={payment.id || index}>
              <LinkedCardPill
                card={linkedCard}
                payment={payment}
                onPress={editing ? () => { setEditingPaymentIndex(index); setShowPicker(true); } : undefined}
              />
              {editing && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={s.changeLink}
                  onPress={() => { setEditingPaymentIndex(index); setShowPicker(true); }}
                >
                  <Ionicons name="swap-horizontal-outline" size={13} color={DS.brandBlue} />
                  <Text style={s.changeLinkText}>Change card</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        } else {
          // ── Not linked ──
          return (
            <View key={payment.id || index}>
              <UnlinkedPaymentPill
                payment={payment}
                onSaveCard={navigation ? handleSaveNewCard : undefined}
              />
              {editing && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={s.changeLink}
                  onPress={() => { setEditingPaymentIndex(index); setShowPicker(true); }}
                >
                  <Ionicons name="link-outline" size={13} color={DS.brandBlue} />
                  <Text style={s.changeLinkText}>Link to saved card</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }
      })}

      {/* Card Picker Modal */}
      <CardPickerModal
        visible={showPicker}
        onClose={() => { setShowPicker(false); setEditingPaymentIndex(null); }}
        cards={savedCards}
        selectedId={editingPaymentIndex !== null ? payments[editingPaymentIndex]?.payment_method_id : null}
        onSelect={handleSelectCard}
      />
    </View>
  );
}


// ═════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  section: {
    backgroundColor: DS.bgSurface, borderRadius: 20, padding: 20, marginTop: 14,
    borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.8, shadowRadius: 12 },
      android: { elevation: 1 },
    }),
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: DS.textPrimary },
  splitBadge: {
    marginLeft: 'auto', backgroundColor: DS.accentGoldSub,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
  },
  splitText: { fontSize: 11, fontWeight: '700', color: DS.accentGold },

  // ── Linked card ──
  linkedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, marginBottom: 6,
    borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgSurface,
  },
  linkedDot: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  linkedInfo: { flex: 1 },
  linkedName: { fontSize: 15, fontWeight: '700', color: DS.textPrimary },
  linkedMeta: { fontSize: 12, fontWeight: '500', color: DS.textSecondary, marginTop: 2 },
  linkedAmount: { fontSize: 15, fontWeight: '700', color: DS.textPrimary },

  // ── Unlinked payment ──
  unlinkedWrap: { marginBottom: 6 },
  unlinkedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: DS.border, borderStyle: 'dashed',
    backgroundColor: DS.bgSurface2 + '60',
  },
  unlinkedDot: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: DS.bgSurface2,
    justifyContent: 'center', alignItems: 'center',
  },
  unlinkedInfo: { flex: 1 },
  unlinkedType: { fontSize: 14, fontWeight: '600', color: DS.textPrimary },
  unlinkedNum: { fontSize: 12, fontWeight: '600', color: DS.textSecondary, marginTop: 2, letterSpacing: 1 },
  unlinkedAmount: { fontSize: 15, fontWeight: '700', color: DS.textPrimary },

  contactlessBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: DS.brandBlue + '12', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  contactlessText: { fontSize: 10, fontWeight: '700', color: DS.brandBlue },

  // ── Save card / Change card links ──
  saveCardLink: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingTop: 6, paddingLeft: 4, marginBottom: 4,
  },
  saveCardText: { fontSize: 13, fontWeight: '600', color: DS.brandBlue },

  changeLink: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingTop: 4, paddingLeft: 4, marginBottom: 6,
  },
  changeLinkText: { fontSize: 13, fontWeight: '600', color: DS.brandBlue },

  // ── Unknown / no data ──
  unknownPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 14,
    backgroundColor: DS.bgSurface2, borderWidth: 1, borderColor: DS.border,
  },
  unknownText: { fontSize: 14, fontWeight: '500', color: DS.textSecondary },

  // ── Card Picker Modal ──
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: {
    backgroundColor: DS.bgSurface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  pickerHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: DS.border,
    alignSelf: 'center', marginBottom: 18,
  },
  pickerTitle: { fontSize: 18, fontWeight: '700', color: DS.textPrimary, marginBottom: 16 },

  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: DS.bgSurface2,
  },
  pickerRowActive: {
    backgroundColor: DS.bgSurface2, borderRadius: 12,
    marginHorizontal: -8, paddingHorizontal: 16,
    borderBottomWidth: 0,
  },
  pickerDot: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  pickerInfo: { flex: 1 },
  pickerName: { fontSize: 15, fontWeight: '600', color: DS.textPrimary },
  pickerMeta: { fontSize: 12, fontWeight: '500', color: DS.textSecondary, marginTop: 2 },
});