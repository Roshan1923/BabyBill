import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/Feather';
import { supabase } from '../config/supabase';
import { useFocusEffect } from '@react-navigation/native';

// ─── Design System ───────────────────────────────────────────
const DS = {
  bgPage:        "#FAF8F4",
  bgSurface:     "#FFFEFB",
  bgSurface2:    "#F5F2EC",
  brandNavy:     "#1A3A6B",
  brandBlue:     "#2563C8",
  accentGold:    "#E8A020",
  accentGoldSub: "#FEF3DC",
  textPrimary:   "#1C1610",
  textSecondary: "#8A7E72",
  textMuted:     "#B8B0A4",
  textInverse:   "#FFFEFB",
  positive:      "#2A8C5C",
  negative:      "#C8402A",
  border:        "#EDE8E0",
  shadow:        "rgba(26,58,107,0.10)",
  pagePad:       20,
  cardRadius:    20,
};

const COLOR_PRESETS = [
  { hex: '#E8A020', label: 'Gold' },
  { hex: '#2A8C5C', label: 'Green' },
  { hex: '#C8402A', label: 'Red' },
  { hex: '#1A3A6B', label: 'Navy' },
  { hex: '#2563C8', label: 'Blue' },
  { hex: '#7C3AED', label: 'Purple' },
  { hex: '#0F766E', label: 'Teal' },
  { hex: '#78350F', label: 'Brown' },
  { hex: '#475569', label: 'Slate' },
  { hex: '#1C1610', label: 'Black' },
];

// ═════════════════════════════════════════════════════════════
// GIFT CARD ROW ITEM
// ═════════════════════════════════════════════════════════════

const GiftCardRow = ({ card, onEdit, onDelete, isLast }) => (
  <View style={[row.container, !isLast && row.border]}>
    <TouchableOpacity activeOpacity={0.7} style={row.main} onPress={() => onEdit(card)}>
      {/* Color dot + icon */}
      <View style={[row.colorDot, { backgroundColor: card.color || DS.accentGold }]}>
        <Ionicons name="gift" size={16} color="#fff" />
      </View>

      {/* Info */}
      <View style={row.info}>
        <Text style={row.name}>{card.name || 'Gift Card'}</Text>
        <Text style={row.sub}>
          {card.last_four ? `•••• ${card.last_four}` : 'No card number'}
          {card.tags?.length > 0 ? `  ·  ${card.tags.filter(t => t !== 'personal' && t !== 'business').join(', ')}` : ''}
        </Text>
      </View>

      {/* Edit chevron */}
      <Ionicons name="chevron-forward" size={18} color={DS.textMuted} />
    </TouchableOpacity>

    {/* Delete */}
    <TouchableOpacity activeOpacity={0.7} style={row.deleteBtn} onPress={() => onDelete(card)}>
      <Ionicons name="trash-outline" size={16} color={DS.negative} />
    </TouchableOpacity>
  </View>
);

const row = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  border: { borderBottomWidth: 1, borderBottomColor: DS.bgSurface2 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 14 },
  colorDot: {
    width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: DS.textPrimary },
  sub: { fontSize: 13, fontWeight: '400', color: DS.textSecondary, marginTop: 3 },
  deleteBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: DS.negative + '10',
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
});


// ═════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════

const GiftCardsScreen = ({ navigation }) => {
  const [giftCards, setGiftCards] = useState([]);
  const [loading, setLoading] = useState(true);

  // Bottom sheet state
  const [showSheet, setShowSheet] = useState(false);
  const [editingCard, setEditingCard] = useState(null); // null = adding, object = editing
  const [sheetName, setSheetName] = useState('');
  const [sheetLastFour, setSheetLastFour] = useState('');
  const [sheetColor, setSheetColor] = useState(DS.accentGold);
  const [sheetTags, setSheetTags] = useState([]);
  const [sheetTagInput, setSheetTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Real Supabase fetch ──
  const fetchGiftCards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from('payment_methods').select('*')
        .eq('user_id', user.id).eq('is_active', true).eq('type', 'gift_card')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setGiftCards(data || []);
    } catch (err) { console.error('Error:', err); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchGiftCards();
  }, [fetchGiftCards]));

  // ── Open sheet for add ──
  const openAdd = () => {
    setEditingCard(null);
    setSheetName('');
    setSheetLastFour('');
    setSheetColor(DS.accentGold);
    setSheetTags([]);
    setSheetTagInput('');
    setShowSheet(true);
  };

  // ── Open sheet for edit ──
  const openEdit = (card) => {
    setEditingCard(card);
    setSheetName(card.name || '');
    setSheetLastFour(card.last_four || '');
    setSheetColor(card.color || DS.accentGold);
    setSheetTags((card.tags || []).filter(t => t !== 'personal' && t !== 'business'));
    setSheetTagInput('');
    setShowSheet(true);
  };

  // ── Save (add or edit) ──
  const handleSave = async () => {
    if (!sheetName.trim()) { Alert.alert('Missing Info', 'Please enter a store name.'); return; }

    // Validate last four if provided
    if (sheetLastFour && (sheetLastFour.length !== 4 || !/^\d{4}$/.test(sheetLastFour))) {
      Alert.alert('Invalid', 'Last 4 digits must be exactly 4 numbers, or leave empty.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Error', 'Not logged in.'); setSaving(false); return; }

      if (editingCard) {
        // Update existing gift card
        const { error } = await supabase.from('payment_methods').update({
          name: sheetName.trim(), last_four: sheetLastFour || null,
          color: sheetColor, tags: sheetTags, updated_at: new Date().toISOString(),
        }).eq('id', editingCard.id);
        if (error) throw error;
        setGiftCards(prev => prev.map(c => c.id === editingCard.id ? {
          ...c, name: sheetName.trim(), last_four: sheetLastFour || null, color: sheetColor, tags: sheetTags,
        } : c));
      } else {
        // Insert new gift card
        const { data, error } = await supabase.from('payment_methods').insert({
          user_id: user.id, name: sheetName.trim(), type: 'gift_card',
          last_four: sheetLastFour || null, color: sheetColor, tags: sheetTags,
          is_active: true, is_default: false,
        }).select().single();
        if (error) throw error;
        setGiftCards(prev => [data, ...prev]);
      }
      setShowSheet(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save gift card.');
      console.error(err);
    } finally { setSaving(false); }
  };

  // ── Delete ──
  const handleDelete = (card) => {
    Alert.alert('Delete Gift Card', `Remove "${card.name || 'Gift Card'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('payment_methods').delete().eq('id', card.id);
            setGiftCards(prev => prev.filter(c => c.id !== card.id));
          } catch { Alert.alert('Error', 'Failed to delete.'); }
        },
      },
    ]);
  };

  // ── Tag helpers ──
  const addTag = () => {
    const t = sheetTagInput.trim().toLowerCase();
    if (t && !sheetTags.includes(t)) setSheetTags(prev => [...prev, t]);
    setSheetTagInput('');
  };
  const removeTag = (tag) => setSheetTags(prev => prev.filter(t => t !== tag));

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={DS.bgPage} />
        <View style={s.loadCenter}><ActivityIndicator size="large" color={DS.brandNavy} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={DS.bgPage} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>GIFT CARDS</Text>
        <TouchableOpacity activeOpacity={0.8} style={s.addPill} onPress={openAdd}>
          <Ionicons name="add" size={18} color={DS.textPrimary} />
          <Text style={s.addPillText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ── Hero Card ── */}
        <View style={s.heroBand}>
          <View style={s.heroCard}>
            <View style={s.heroTop}>
              <Ionicons name="gift-outline" size={28} color="rgba(255,255,255,0.85)" />
              <Text style={s.heroLabel}>GIFT CARDS</Text>
            </View>
            <View style={s.heroMid}>
              <Text style={s.heroCount}>{giftCards.length}</Text>
              <Text style={s.heroCountLabel}>{giftCards.length === 1 ? 'card saved' : 'cards saved'}</Text>
            </View>
            <Text style={s.heroSub}>Store gift cards & credits</Text>
          </View>
        </View>

        {/* ── Gift Cards List ── */}
        {giftCards.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyIcon}>
              <Ionicons name="gift-outline" size={40} color={DS.textSecondary} />
            </View>
            <Text style={s.emptyTitle}>No gift cards saved</Text>
            <Text style={s.emptySub}>
              When a receipt shows a gift card payment,{'\n'}you can save it here for tracking.
            </Text>
            <TouchableOpacity activeOpacity={0.85} style={s.emptyCTA} onPress={openAdd}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={s.emptyCTAText}>Add Gift Card</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.listBox}>
            <Text style={s.listTitle}>SAVED GIFT CARDS</Text>
            {giftCards.map((gc, i) => (
              <GiftCardRow
                key={gc.id}
                card={gc}
                onEdit={openEdit}
                onDelete={handleDelete}
                isLast={i === giftCards.length - 1}
              />
            ))}

            {/* Add button at bottom of list */}
            <TouchableOpacity activeOpacity={0.8} style={s.addRow} onPress={openAdd}>
              <View style={s.addRowIcon}>
                <Ionicons name="add" size={20} color={DS.accentGold} />
              </View>
              <Text style={s.addRowText}>Add another gift card</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ═══ ADD / EDIT BOTTOM SHEET ═══ */}
      <Modal visible={showSheet} transparent animationType="slide" onRequestClose={() => setShowSheet(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity activeOpacity={1} style={m.overlay} onPress={() => setShowSheet(false)}>
            <TouchableOpacity activeOpacity={1} style={m.sheet} onPress={() => {}}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={m.handle} />

                {/* Header */}
                <View style={m.headerRow}>
                  <Ionicons name="gift" size={22} color={DS.accentGold} />
                  <Text style={m.title}>{editingCard ? 'Edit Gift Card' : 'Add Gift Card'}</Text>
                </View>

                {/* Preview */}
                <View style={[m.preview, { backgroundColor: sheetColor }]}>
                  <Ionicons name="gift" size={20} color="rgba(255,255,255,0.8)" />
                  <Text style={m.previewName}>{sheetName || 'Store Name'}</Text>
                  {sheetLastFour ? <Text style={m.previewNum}>•••• {sheetLastFour}</Text> : null}
                </View>

                {/* Store Name */}
                <Text style={m.fieldLabel}>Store name <Text style={m.required}>*</Text></Text>
                <TextInput style={m.input} value={sheetName} onChangeText={setSheetName}
                  placeholder="e.g. Starbucks, Amazon, Costco" placeholderTextColor={DS.textMuted} />

                {/* Last Four */}
                <Text style={m.fieldLabel}>Last 4 digits <Text style={m.optional}>(optional)</Text></Text>
                <TextInput style={[m.input, { letterSpacing: 6, textAlign: 'center', fontWeight: '700' }]}
                  value={sheetLastFour}
                  onChangeText={(t) => setSheetLastFour(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="0000" placeholderTextColor={DS.textMuted}
                  keyboardType="number-pad" maxLength={4} />

                {/* Color */}
                <Text style={m.fieldLabel}>Color</Text>
                <View style={m.colorRow}>
                  {COLOR_PRESETS.map((c) => (
                    <TouchableOpacity key={c.hex} activeOpacity={0.8}
                      style={[m.colorDot, { backgroundColor: c.hex }, sheetColor === c.hex && m.colorDotActive]}
                      onPress={() => setSheetColor(c.hex)}>
                      {sheetColor === c.hex && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Tags */}
                <Text style={m.fieldLabel}>Tags <Text style={m.optional}>(optional)</Text></Text>
                {sheetTags.length > 0 && (
                  <View style={m.tagChips}>
                    {sheetTags.map((t, i) => (
                      <TouchableOpacity key={i} activeOpacity={0.7} onPress={() => removeTag(t)} style={m.tagChip}>
                        <Text style={m.tagChipText}>{t}</Text>
                        <Ionicons name="close" size={12} color={DS.accentGold} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={m.tagInputRow}>
                  <TextInput style={m.tagInput} value={sheetTagInput} onChangeText={setSheetTagInput}
                    onSubmitEditing={addTag} placeholder="Add tag..." placeholderTextColor={DS.textMuted} returnKeyType="done" />
                  {sheetTagInput.trim() ? (
                    <TouchableOpacity onPress={addTag} activeOpacity={0.7}>
                      <Ionicons name="add-circle" size={26} color={DS.accentGold} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Buttons */}
                <View style={m.btnRow}>
                  <TouchableOpacity activeOpacity={0.7} style={m.cancelBtn}
                    onPress={() => setShowSheet(false)}>
                    <Text style={m.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.85} style={m.saveBtn} onPress={handleSave} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={m.saveText}>{editingCard ? 'Save Changes' : 'Save Card'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};


// ═════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DS.bgPage },
  loadCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: DS.pagePad, paddingTop: 6, paddingBottom: 10,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: DS.bgSurface,
    justifyContent: 'center', alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: DS.textPrimary, letterSpacing: 0.8 },
  addPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
    backgroundColor: DS.bgSurface, borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  addPillText: { fontSize: 14, fontWeight: '600', color: DS.textPrimary },

  // Hero
  heroBand: { backgroundColor: DS.bgSurface2 + '80', paddingVertical: 28, paddingHorizontal: DS.pagePad, marginBottom: 20 },
  heroCard: {
    backgroundColor: DS.accentGold, borderRadius: 20, padding: 24,
    ...Platform.select({
      ios: { shadowColor: 'rgba(232,160,32,0.4)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 8 },
    }),
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heroLabel: { fontSize: 16, fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: 1.5 },
  heroMid: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  heroCount: { fontSize: 36, fontWeight: '800', color: '#fff' },
  heroCountLabel: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  heroSub: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.6)' },

  // List
  listBox: {
    marginHorizontal: DS.pagePad, backgroundColor: DS.bgSurface,
    borderRadius: DS.cardRadius, padding: 20, borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 14 },
      android: { elevation: 3 },
    }),
  },
  listTitle: { fontSize: 12, fontWeight: '800', color: DS.textSecondary, letterSpacing: 1.2, marginBottom: 8 },

  // Add row at bottom
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingTop: 16, marginTop: 8, borderTopWidth: 1, borderTopColor: DS.bgSurface2,
  },
  addRowIcon: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: DS.accentGoldSub, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderStyle: 'dashed', borderColor: DS.accentGold + '50',
  },
  addRowText: { fontSize: 15, fontWeight: '600', color: DS.accentGold },

  // Empty
  emptyWrap: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: DS.bgSurface2,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: DS.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: 14, color: DS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptyCTA: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: DS.accentGold, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16,
  },
  emptyCTAText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

// ─── Modal / Sheet Styles ────────────────────────────────────
const m = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: DS.bgSurface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '88%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: DS.border, alignSelf: 'center', marginBottom: 18 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: DS.textPrimary },

  // Preview
  preview: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 16, marginBottom: 22,
  },
  previewName: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1 },
  previewNum: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: 2 },

  // Fields
  fieldLabel: { fontSize: 13, fontWeight: '700', color: DS.textSecondary, letterSpacing: 0.5, marginBottom: 8, marginTop: 6 },
  required: { color: DS.negative, fontWeight: '700' },
  optional: { color: DS.textMuted, fontWeight: '400', fontSize: 12 },

  input: {
    height: 50, borderRadius: 14, paddingHorizontal: 16,
    backgroundColor: DS.bgSurface2, fontSize: 16, fontWeight: '500',
    color: DS.textPrimary, borderWidth: 1, borderColor: DS.border, marginBottom: 6,
  },

  // Color
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10, marginTop: 4 },
  colorDot: {
    width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: DS.bgPage,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 5 },
      android: { elevation: 3 },
    }),
  },

  // Tags
  tagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: DS.accentGoldSub,
  },
  tagChipText: { fontSize: 13, fontWeight: '700', color: DS.accentGold, textTransform: 'capitalize' },
  tagInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  tagInput: {
    flex: 1, height: 42, borderRadius: 12, paddingHorizontal: 14,
    backgroundColor: DS.bgSurface2, fontSize: 14, color: DS.textPrimary,
  },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    backgroundColor: DS.bgSurface2,
  },
  cancelText: { fontSize: 16, fontWeight: '600', color: DS.textPrimary },
  saveBtn: {
    flex: 1, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    backgroundColor: DS.accentGold,
  },
  saveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

export default GiftCardsScreen;