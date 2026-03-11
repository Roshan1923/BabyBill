import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
  Animated,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/Feather';
import { supabase } from '../config/supabase';

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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DETAIL_CARD_WIDTH = SCREEN_WIDTH * 0.58;
const DETAIL_CARD_HEIGHT = DETAIL_CARD_WIDTH * 1.35;

const NETWORK_LABEL = {
  visa: 'VISA', mastercard: 'MASTERCARD', amex: 'AMEX',
  interac: 'INTERAC', discover: 'DISCOVER', rupay: 'RUPAY',
};
const NETWORKS = ['visa', 'mastercard', 'amex', 'interac', 'discover', 'rupay', 'other'];
const NETWORK_DISPLAY = {
  visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex',
  interac: 'Interac', discover: 'Discover', rupay: 'RuPay', other: 'Other',
};

const COLOR_PRESETS = [
  { hex: '#1A3A6B', label: 'Navy' },
  { hex: '#1C1610', label: 'Black' },
  { hex: '#2563C8', label: 'Blue' },
  { hex: '#2A8C5C', label: 'Green' },
  { hex: '#C8402A', label: 'Red' },
  { hex: '#E8A020', label: 'Gold' },
  { hex: '#7C3AED', label: 'Purple' },
  { hex: '#0F766E', label: 'Teal' },
  { hex: '#475569', label: 'Slate' },
  { hex: '#78350F', label: 'Brown' },
];

const ALIAS_INSTRUCTIONS = {
  'Apple Pay': [
    'Open the Wallet app on your iPhone',
    'Tap the card you want to link',
    'Tap the ••• icon (top right)',
    'Scroll to "Device Account Number"',
    'Note the last 4 digits',
  ],
  'Google Pay': [
    'Open Google Pay app',
    'Tap on your card',
    'Tap "Details"',
    'Look for "Virtual account number"',
    'Note the last 4 digits',
  ],
  'Samsung Pay': [
    'Open Samsung Pay',
    'Tap your card',
    'Tap "Card info"',
    'Find the device card number',
    'Note the last 4 digits',
  ],
  'Other': [
    'Check your digital wallet app',
    'Find the virtual or device card number',
    'Note the last 4 digits',
  ],
};
const ALIAS_LABELS = Object.keys(ALIAS_INSTRUCTIONS);


// ═════════════════════════════════════════════════════════════
// CARD PREVIEW
// ═════════════════════════════════════════════════════════════

const CardPreview = ({ color, network, lastFour, name, aliases }) => {
  const net = NETWORK_LABEL[network] || 'CARD';
  const l4 = lastFour || '••••';

  return (
    <View style={[pv.card, { backgroundColor: color || DS.brandNavy }]}>
      <View style={pv.top}>
        <View style={pv.chipRow}>
          <View style={pv.chip}><View style={pv.chipH} /><View style={pv.chipV} /></View>
          <Ionicons name="wifi-outline" size={14} color="rgba(255,255,255,0.45)"
            style={{ transform: [{ rotate: '90deg' }], marginLeft: 5 }} />
        </View>
        <Text style={pv.net}>{net}</Text>
      </View>
      <View style={pv.mid}>
        <Text style={pv.mask}>••••</Text>
        <Text style={pv.mask}>••••</Text>
        <Text style={pv.mask}>••••</Text>
        <Text style={[pv.mask, pv.real]}>{l4}</Text>
      </View>
      <View style={pv.bot}>
        <Text style={pv.ownerName} numberOfLines={1}>{name || 'Card Name'}</Text>
        {aliases && aliases.length > 0 && (
          <View style={pv.aliasRow}>
            {aliases.slice(0, 2).map((a, i) => (
              <View key={i} style={pv.aliasBadge}>
                <Ionicons name="phone-portrait-outline" size={9} color="rgba(255,255,255,0.7)" />
                <Text style={pv.aliasText}>{a.label} ····{a.last_four}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const pv = StyleSheet.create({
  card: {
    width: DETAIL_CARD_WIDTH, height: DETAIL_CARD_HEIGHT,
    borderRadius: 18, padding: 16, justifyContent: 'space-between',
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.3)', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 22 },
      android: { elevation: 10 },
    }),
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipRow: { flexDirection: 'row', alignItems: 'center' },
  chip: { width: 28, height: 20, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  chipH: { position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  chipV: { position: 'absolute', width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.3)' },
  net: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5 },
  mid: { gap: 1 },
  mask: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.35)', letterSpacing: 2.5 },
  real: { color: 'rgba(255,255,255,0.9)' },
  bot: { gap: 4 },
  ownerName: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  aliasRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  aliasBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
  },
  aliasText: { fontSize: 8, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
});


// ═════════════════════════════════════════════════════════════
// SIDE ACTION BUTTON
// ═════════════════════════════════════════════════════════════

const SideAction = ({ icon, label, onPress, iconColor }) => (
  <TouchableOpacity activeOpacity={0.8} style={sa.wrap} onPress={onPress}>
    <View style={sa.circle}>
      <Ionicons name={icon} size={22} color={iconColor || DS.textPrimary} />
    </View>
    <Text style={sa.label}>{label}</Text>
  </TouchableOpacity>
);

const sa = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  circle: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: DS.bgSurface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  label: { fontSize: 12, fontWeight: '600', color: DS.textSecondary, textAlign: 'center', maxWidth: 76 },
});


// ═════════════════════════════════════════════════════════════
// INFO FIELD
// ═════════════════════════════════════════════════════════════

const InfoField = ({ icon, label, value, onPress, children, isLast }) => (
  <TouchableOpacity activeOpacity={onPress ? 0.7 : 1} onPress={onPress}
    style={[ff.row, !isLast && ff.border]}>
    <View style={ff.left}>
      <View style={ff.iconWrap}><Ionicons name={icon} size={16} color={DS.textSecondary} /></View>
      <Text style={ff.label}>{label}</Text>
    </View>
    {children || (
      <View style={ff.right}>
        <Text style={ff.value}>{value}</Text>
        {onPress && <Ionicons name="chevron-forward" size={15} color={DS.textMuted} style={{ marginLeft: 4 }} />}
      </View>
    )}
  </TouchableOpacity>
);

const ff = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  border: { borderBottomWidth: 1, borderBottomColor: DS.bgSurface2 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: DS.bgSurface2, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '500', color: DS.textSecondary },
  right: { flexDirection: 'row', alignItems: 'center' },
  value: { fontSize: 15, fontWeight: '700', color: DS.textPrimary },
});


// ═════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════

const CardDetailScreen = ({ navigation, route }) => {
  const originalCard = route.params?.card;
  const prefill = route.params?.prefill;  // from "Save this card" in PaymentSection
  const isNewCard = !originalCard;

  const randomColor = COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)].hex;

  // Initialize with prefill data if available (from PaymentSection "Save this card")
  const [name, setName] = useState(originalCard?.name || '');
  const [network, setNetwork] = useState(originalCard?.network || prefill?.network || 'visa');
  const [type, setType] = useState(originalCard?.type || prefill?.type || 'credit');
  const [lastFour, setLastFour] = useState(originalCard?.last_four || prefill?.last_four || '');
  const [tags, setTags] = useState(originalCard?.tags || []);
  const [color, setColor] = useState(originalCard?.color || randomColor);
  const [usage, setUsage] = useState('personal');
  const [tagInput, setTagInput] = useState('');

  const [showAlias, setShowAlias] = useState(false);
  const [showColor, setShowColor] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const [aliasLabel, setAliasLabel] = useState('Apple Pay');
  const [aliasLastFour, setAliasLastFour] = useState('');
  const [aliases, setAliases] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tags.includes('business')) setUsage('business');
    else setUsage('personal');
  }, []);

  // Fetch existing aliases for edit mode
  useEffect(() => {
    if (originalCard?.id) {
      (async () => {
        const { data } = await supabase.from('payment_method_aliases').select('*').eq('payment_method_id', originalCard.id);
        setAliases(data || []);
      })();
    }
  }, [originalCard?.id]);

  const hasChanges = () => {
    if (isNewCard) return name.trim().length > 0 || lastFour.length > 0;
    return name !== originalCard?.name || network !== originalCard?.network ||
      type !== originalCard?.type || lastFour !== originalCard?.last_four ||
      color !== originalCard?.color || JSON.stringify(tags) !== JSON.stringify(originalCard?.tags || []);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Missing Info', 'Please enter a card name.'); return; }
    if (!lastFour || lastFour.length !== 4) { Alert.alert('Missing Info', 'Please enter the last 4 digits of your card.'); return; }

    let finalTags = tags.filter(t => t !== 'personal' && t !== 'business');
    finalTags = [usage, ...finalTags];

    setSaving(true);

    try {
      if (isNewCard) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { Alert.alert('Error', 'Not logged in.'); setSaving(false); return; }

        const { data: newCard, error } = await supabase.from('payment_methods').insert({
          user_id: user.id,
          name: name.trim(),
          network,
          type,
          last_four: lastFour,
          tags: finalTags,
          color,
          is_default: false,
          is_active: true,
        }).select().single();
        if (error) throw error;

        // Save any aliases added during creation
        if (aliases.length > 0 && newCard?.id) {
          for (const a of aliases) {
            await supabase.from('payment_method_aliases').insert({
              payment_method_id: newCard.id,
              user_id: user.id,
              last_four: a.last_four,
              label: a.label,
            });
          }
        }
      } else {
        const { error } = await supabase.from('payment_methods').update({
          name: name.trim(), network, type, last_four: lastFour,
          tags: finalTags, color, updated_at: new Date().toISOString(),
        }).eq('id', originalCard.id);
        if (error) throw error;
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', isNewCard ? 'Failed to save card.' : 'Failed to save changes.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges()) {
      Alert.alert('Discard Changes?', 'You have unsaved changes.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else { navigation.goBack(); }
  };

  const handleArchive = async () => {
    try {
      await supabase.from('payment_methods').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', originalCard.id);
      setShowArchive(false); navigation.goBack();
    } catch { Alert.alert('Error', 'Failed to archive card.'); }
  };

  const handleSaveAlias = async () => {
    if (aliasLastFour.length !== 4 || !/^\d{4}$/.test(aliasLastFour)) {
      Alert.alert('Invalid', 'Please enter exactly 4 digits.'); return;
    }

    if (isNewCard) {
      // For new cards, store alias locally — will be saved with the card
      setAliases(prev => [...prev, { id: Date.now(), label: aliasLabel, last_four: aliasLastFour }]);
      setShowAlias(false); setAliasLastFour(''); return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('payment_method_aliases').insert({
        payment_method_id: originalCard.id, user_id: user.id, last_four: aliasLastFour, label: aliasLabel,
      });
      if (error) throw error;
      setAliases(prev => [...prev, { id: Date.now(), label: aliasLabel, last_four: aliasLastFour }]);
      setShowAlias(false); setAliasLastFour('');
    } catch { Alert.alert('Error', 'Failed to save alias.'); }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && t !== 'personal' && t !== 'business') setTags(prev => [...prev, t]);
    setTagInput('');
  };
  const removeTag = (tag) => setTags(prev => prev.filter(t => t !== tag));

  const removeAlias = async (alias) => {
    Alert.alert(
      'Remove Alias',
      `Remove ${alias.label || 'alias'} ····${alias.last_four}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            if (isNewCard) {
              // For new cards, just remove from local state
              setAliases(prev => prev.filter(a => a.id !== alias.id));
              return;
            }
            try {
              const { error } = await supabase
                .from('payment_method_aliases')
                .delete()
                .eq('id', alias.id);
              if (error) throw error;
              setAliases(prev => prev.filter(a => a.id !== alias.id));
            } catch {
              Alert.alert('Error', 'Failed to remove alias.');
            }
          },
        },
      ]
    );
  };

  const displayTags = tags.filter(t => t !== 'personal' && t !== 'business');
  const instructions = ALIAS_INSTRUCTIONS[aliasLabel] || ALIAS_INSTRUCTIONS['Other'];

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={DS.bgPage} />

      <View style={s.header}>
        <TouchableOpacity onPress={handleCancel} style={s.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isNewCard ? 'ADD CARD' : 'CARD DETAILS'}</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={10}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <View style={s.cardBand}>
            <View style={s.sideCol}>
              <SideAction icon="phone-portrait-outline" label="Add Alias" onPress={() => setShowAlias(true)} />
              <SideAction icon="color-palette-outline" label="Color" onPress={() => setShowColor(true)} iconColor={color} />
              {!isNewCard && (
                <SideAction icon="archive-outline" label="Archive" onPress={() => setShowArchive(true)} iconColor={DS.negative} />
              )}
            </View>
            <CardPreview color={color} network={network} lastFour={lastFour} name={name} aliases={aliases} />
          </View>

          {aliases.length > 0 && (
            <View style={s.aliasBox}>
              <Text style={s.aliasBoxTitle}>ALSO APPEARS AS</Text>
              {aliases.map((a, i) => (
                <View key={a.id || i} style={s.aliasItem}>
                  <View style={s.aliasItemLeft}>
                    <Ionicons name="phone-portrait-outline" size={16} color={DS.brandBlue} />
                    <View>
                      <Text style={s.aliasItemLabel}>{a.label || 'Alias'}</Text>
                      <Text style={s.aliasItemNum}>•••• {a.last_four}</Text>
                    </View>
                  </View>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => removeAlias(a)} style={s.aliasRemoveBtn}>
                    <Ionicons name="trash-outline" size={16} color={DS.negative} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={s.infoBox}>
            <Text style={s.infoTitle}>CARD INFORMATION</Text>

            <View style={s.usageRow}>
              <View style={ff.left}>
                <View style={ff.iconWrap}><Ionicons name="briefcase-outline" size={16} color={DS.textSecondary} /></View>
                <Text style={ff.label}>Usage</Text>
              </View>
              <View style={s.usageToggle}>
                <TouchableOpacity activeOpacity={0.8}
                  style={[s.usagePill, usage === 'personal' && s.usagePillActive]}
                  onPress={() => setUsage('personal')}>
                  <Text style={[s.usagePillText, usage === 'personal' && s.usagePillTextActive]}>Personal</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8}
                  style={[s.usagePill, usage === 'business' && s.usagePillBiz]}
                  onPress={() => setUsage('business')}>
                  <Text style={[s.usagePillText, usage === 'business' && s.usagePillTextBiz]}>Business</Text>
                </TouchableOpacity>
              </View>
            </View>

            <InfoField icon="text-outline" label="Card name">
              <TextInput style={s.fieldInput} value={name} onChangeText={setName}
                placeholder="e.g. TD Visa Infinite" placeholderTextColor={DS.textMuted} />
            </InfoField>

            <InfoField icon="card-outline" label="Network" value={NETWORK_DISPLAY[network] || 'Other'}
              onPress={() => setShowNetwork(true)} />

            <InfoField icon="swap-horizontal-outline" label="Type">
              <View style={s.typeToggle}>
                <TouchableOpacity activeOpacity={0.8} style={[s.typePill, type === 'credit' && s.typePillOn]}
                  onPress={() => setType('credit')}>
                  <Text style={[s.typePillText, type === 'credit' && s.typePillTextOn]}>Credit</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={[s.typePill, type === 'debit' && s.typePillOn]}
                  onPress={() => setType('debit')}>
                  <Text style={[s.typePillText, type === 'debit' && s.typePillTextOn]}>Debit</Text>
                </TouchableOpacity>
              </View>
            </InfoField>

            <InfoField icon="keypad-outline" label="Last four">
              <TextInput style={[s.fieldInput, { letterSpacing: 5, fontWeight: '800' }]}
                value={lastFour} onChangeText={(t) => setLastFour(t.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="0000" placeholderTextColor={DS.textMuted} keyboardType="number-pad" maxLength={4} />
            </InfoField>

            <InfoField icon="pricetags-outline" label="Tags" isLast>
              <View style={{ flex: 1 }} />
            </InfoField>
            <View style={s.tagsArea}>
              <View style={s.tagChips}>
                {displayTags.map((t, i) => (
                  <TouchableOpacity key={i} activeOpacity={0.7} onPress={() => removeTag(t)} style={s.tagChip}>
                    <Text style={s.tagChipText}>{t}</Text>
                    <Ionicons name="close" size={13} color={DS.accentGold} />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.tagInputRow}>
                <TextInput style={s.tagInput} value={tagInput} onChangeText={setTagInput}
                  onSubmitEditing={addTag} placeholder="Add tag..." placeholderTextColor={DS.textMuted} returnKeyType="done" />
                {tagInput.trim() ? (
                  <TouchableOpacity onPress={addTag} activeOpacity={0.7}>
                    <Ionicons name="add-circle" size={26} color={DS.accentGold} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          <View style={s.bottomBtns}>
            <TouchableOpacity activeOpacity={0.85} style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.saveBtnText}>{isNewCard ? 'Save Card' : 'Save Changes'}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} style={s.cancelBtn} onPress={handleCancel}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══ ALIAS MODAL ═══ */}
      <Modal visible={showAlias} transparent animationType="slide" onRequestClose={() => setShowAlias(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity activeOpacity={1} style={m.overlay} onPress={() => setShowAlias(false)}>
            <TouchableOpacity activeOpacity={1} style={m.sheet} onPress={() => {}}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={m.handle} />
                <View style={m.headerRow}>
                  <Ionicons name="phone-portrait-outline" size={24} color={DS.brandNavy} />
                  <Text style={m.title}>Link Digital Wallet</Text>
                </View>
                <Text style={m.desc}>
                  Your digital wallet (Apple Pay, Google Pay) uses different last 4 digits than your physical card. Add them here so BillBrain knows it's the same card.
                </Text>

                <Text style={m.fieldLabel}>Wallet type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={m.labelRow}>
                    {ALIAS_LABELS.map((l) => (
                      <TouchableOpacity key={l} activeOpacity={0.8}
                        style={[m.labelPill, aliasLabel === l && m.labelPillOn]}
                        onPress={() => setAliasLabel(l)}>
                        <Text style={[m.labelPillText, aliasLabel === l && m.labelPillTextOn]}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <View style={m.instructBox}>
                  <Text style={m.instructTitle}>How to find your {aliasLabel} number:</Text>
                  {instructions.map((step, i) => (
                    <View key={i} style={m.stepRow}>
                      <View style={m.stepCircle}><Text style={m.stepNum}>{i + 1}</Text></View>
                      <Text style={m.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>

                <Text style={m.fieldLabel}>Last 4 digits of device account</Text>
                <TextInput style={m.input} value={aliasLastFour}
                  onChangeText={(t) => setAliasLastFour(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="0000" placeholderTextColor={DS.textMuted}
                  keyboardType="number-pad" maxLength={4} />

                <View style={m.btnRow}>
                  <TouchableOpacity activeOpacity={0.7} style={m.cancelBtn}
                    onPress={() => { setShowAlias(false); setAliasLastFour(''); }}>
                    <Text style={m.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.85} style={m.saveBtn} onPress={handleSaveAlias}>
                    <Text style={m.saveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ COLOR PICKER ═══ */}
      <Modal visible={showColor} transparent animationType="fade" onRequestClose={() => setShowColor(false)}>
        <TouchableOpacity activeOpacity={1} style={m.overlay} onPress={() => setShowColor(false)}>
          <View style={m.colorSheet}>
            <Text style={m.colorTitle}>Card Color</Text>
            <View style={m.colorGrid}>
              {COLOR_PRESETS.map((c) => (
                <TouchableOpacity key={c.hex} activeOpacity={0.8}
                  style={[m.colorCircle, { backgroundColor: c.hex }, color === c.hex && m.colorActive]}
                  onPress={() => { setColor(c.hex); setShowColor(false); }}>
                  {color === c.hex && <Ionicons name="checkmark" size={20} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ═══ NETWORK PICKER ═══ */}
      <Modal visible={showNetwork} transparent animationType="fade" onRequestClose={() => setShowNetwork(false)}>
        <TouchableOpacity activeOpacity={1} style={m.overlay} onPress={() => setShowNetwork(false)}>
          <View style={m.colorSheet}>
            <Text style={m.colorTitle}>Card Network</Text>
            {NETWORKS.map((n) => (
              <TouchableOpacity key={n} activeOpacity={0.7}
                style={[m.netRow, network === n && m.netRowOn]}
                onPress={() => { setNetwork(n); setShowNetwork(false); }}>
                <Text style={[m.netText, network === n && m.netTextOn]}>{NETWORK_DISPLAY[n]}</Text>
                {network === n && <Ionicons name="checkmark-circle" size={22} color={DS.brandNavy} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ═══ ARCHIVE ═══ */}
      <Modal visible={showArchive} transparent animationType="fade" onRequestClose={() => setShowArchive(false)}>
        <View style={m.overlay}>
          <View style={m.archiveBox}>
            <View style={[m.archiveIcon, { backgroundColor: DS.negative + '14' }]}>
              <Ionicons name="archive-outline" size={28} color={DS.negative} />
            </View>
            <Text style={m.archiveTitle}>Archive this card?</Text>
            <Text style={m.archiveDesc}>
              The card will be hidden from your wallet. Linked receipts keep their data. You can restore it later.
            </Text>
            <View style={m.btnRow}>
              <TouchableOpacity activeOpacity={0.7} style={m.cancelBtn} onPress={() => setShowArchive(false)}>
                <Text style={m.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.85} style={[m.saveBtn, { backgroundColor: DS.negative }]} onPress={handleArchive}>
                <Text style={m.saveText}>Archive</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};


// ═════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DS.bgPage },

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
  headerTitle: { fontSize: 17, fontWeight: '700', color: DS.textPrimary, letterSpacing: 0.8 },

  cardBand: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: DS.bgSurface2 + '80',
    paddingVertical: 36, paddingLeft: 24, paddingRight: DS.pagePad,
  },
  sideCol: { gap: 26, alignItems: 'center', paddingRight: 4 },

  aliasBox: {
    marginHorizontal: DS.pagePad, marginTop: 16,
    backgroundColor: DS.bgSurface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: DS.border,
  },
  aliasBoxTitle: { fontSize: 11, fontWeight: '700', color: DS.textSecondary, letterSpacing: 1, marginBottom: 10 },
  aliasItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  aliasItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aliasItemLabel: { fontSize: 15, fontWeight: '600', color: DS.textPrimary },
  aliasItemNum: { fontSize: 13, fontWeight: '700', color: DS.brandBlue, letterSpacing: 1, marginTop: 2 },
  aliasRemoveBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: DS.negative + '10',
    justifyContent: 'center', alignItems: 'center',
  },

  infoBox: {
    marginHorizontal: DS.pagePad, marginTop: 16,
    backgroundColor: DS.bgSurface, borderRadius: DS.cardRadius, padding: 20,
    borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 14 },
      android: { elevation: 3 },
    }),
  },
  infoTitle: { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: 1.2, marginBottom: 8 },

  usageRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: DS.bgSurface2,
  },
  usageToggle: { flexDirection: 'row', gap: 6 },
  usagePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: DS.bgSurface2 },
  usagePillActive: { backgroundColor: DS.brandNavy },
  usagePillBiz: { backgroundColor: DS.accentGold },
  usagePillText: { fontSize: 13, fontWeight: '600', color: DS.textSecondary },
  usagePillTextActive: { color: '#fff' },
  usagePillTextBiz: { color: '#fff' },

  fieldInput: { fontSize: 15, fontWeight: '700', color: DS.textPrimary, textAlign: 'right', minWidth: 130, paddingVertical: 0 },

  typeToggle: { flexDirection: 'row', gap: 6 },
  typePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: DS.bgSurface2 },
  typePillOn: { backgroundColor: DS.brandNavy },
  typePillText: { fontSize: 13, fontWeight: '600', color: DS.textSecondary },
  typePillTextOn: { color: '#fff' },

  tagsArea: { paddingBottom: 10 },
  tagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: DS.accentGoldSub,
  },
  tagChipText: { fontSize: 13, fontWeight: '700', color: DS.accentGold, textTransform: 'capitalize' },
  tagInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tagInput: {
    flex: 1, height: 40, borderRadius: 12, paddingHorizontal: 14,
    backgroundColor: DS.bgSurface2, fontSize: 14, color: DS.textPrimary,
  },

  bottomBtns: { marginHorizontal: DS.pagePad, marginTop: 24, gap: 10 },
  saveBtn: {
    height: 54, borderRadius: 16, backgroundColor: DS.brandNavy,
    justifyContent: 'center', alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: DS.brandNavy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  saveBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  cancelBtn: { height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: DS.textSecondary },
});

const m = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },

  sheet: {
    backgroundColor: DS.bgSurface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '85%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: DS.border, alignSelf: 'center', marginBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: DS.textPrimary },
  desc: { fontSize: 14, fontWeight: '400', color: DS.textSecondary, lineHeight: 20, marginBottom: 20 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: DS.textSecondary, letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },

  labelRow: { flexDirection: 'row', gap: 8 },
  labelPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: DS.bgSurface2 },
  labelPillOn: { backgroundColor: DS.brandNavy },
  labelPillText: { fontSize: 14, fontWeight: '600', color: DS.textSecondary },
  labelPillTextOn: { color: '#fff' },

  instructBox: { backgroundColor: DS.bgSurface2, borderRadius: 16, padding: 18, marginBottom: 20 },
  instructTitle: { fontSize: 13, fontWeight: '700', color: DS.textPrimary, marginBottom: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  stepCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: DS.brandNavy, justifyContent: 'center', alignItems: 'center' },
  stepNum: { fontSize: 12, fontWeight: '700', color: '#fff' },
  stepText: { fontSize: 14, fontWeight: '400', color: DS.textPrimary, flex: 1, lineHeight: 20, paddingTop: 2 },

  input: {
    height: 52, borderRadius: 14, paddingHorizontal: 16,
    backgroundColor: DS.bgSurface2, fontSize: 20, fontWeight: '700',
    color: DS.textPrimary, letterSpacing: 8, textAlign: 'center',
    borderWidth: 1, borderColor: DS.border,
  },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 22 },
  cancelBtn: { flex: 1, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: DS.bgSurface2 },
  cancelText: { fontSize: 16, fontWeight: '600', color: DS.textPrimary },
  saveBtn: { flex: 1, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: DS.brandNavy },
  saveText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  colorSheet: {
    backgroundColor: DS.bgSurface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  colorTitle: { fontSize: 18, fontWeight: '700', color: DS.textPrimary, marginBottom: 22, textAlign: 'center' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  colorCircle: {
    width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'transparent',
  },
  colorActive: {
    borderColor: DS.bgPage,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },

  netRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: DS.bgSurface2,
  },
  netRowOn: { backgroundColor: DS.bgSurface2, borderRadius: 12, marginHorizontal: -10, paddingHorizontal: 20 },
  netText: { fontSize: 16, fontWeight: '500', color: DS.textPrimary },
  netTextOn: { fontWeight: '700', color: DS.brandNavy },

  archiveBox: {
    backgroundColor: DS.bgSurface, borderRadius: 24, padding: 28, marginHorizontal: 32,
    alignItems: 'center', alignSelf: 'center', marginBottom: 100,
  },
  archiveIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  archiveTitle: { fontSize: 20, fontWeight: '700', color: DS.textPrimary, marginBottom: 10 },
  archiveDesc: { fontSize: 14, fontWeight: '400', color: DS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
});

export default CardDetailScreen;