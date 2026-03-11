import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar,
  Animated,
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
  textInverse:   "#FFFEFB",
  positive:      "#2A8C5C",
  negative:      "#C8402A",
  border:        "#EDE8E0",
  shadow:        "rgba(26,58,107,0.10)",
  pagePad:       20,
  cardRadius:    20,
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.62;
const CARD_HEIGHT = CARD_WIDTH * 1.32;
const CARD_GAP = 12;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;
const SIDE_PADDING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

const NETWORK_LABEL = {
  visa: 'VISA', mastercard: 'MASTERCARD', amex: 'AMEX',
  interac: 'INTERAC', discover: 'DISCOVER', rupay: 'RUPAY',
};


// ═════════════════════════════════════════════════════════════
// WALLET CARD VISUAL
// ═════════════════════════════════════════════════════════════

const WalletCard = ({ card, isGiftBucket, isAddCard, isActive }) => {
  const scale = useRef(new Animated.Value(isActive ? 1 : 0.88)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isActive ? 1 : 0.88, friction: 8, tension: 50, useNativeDriver: true,
    }).start();
  }, [isActive]);

  const shadow = isActive ? styles.shadowActive : styles.shadowInactive;

  // ── Add Card ──
  if (isAddCard) {
    return (
      <Animated.View style={[styles.cardOuter, { transform: [{ scale }] }]}>
        <View style={[styles.cardFace, styles.addFace]}>
          <View style={styles.addInner}>
            <View style={styles.addRing}>
              <Ionicons name="add" size={32} color={DS.textSecondary} />
            </View>
            <Text style={styles.addTitle}>Add Card</Text>
            <Text style={styles.addSub}>Save a new payment method</Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  // ── Gift Bucket ──
  if (isGiftBucket) {
    return (
      <Animated.View style={[styles.cardOuter, { transform: [{ scale }] }]}>
        <View style={[styles.cardFace, shadow, { backgroundColor: DS.accentGold }]}>
          <View style={styles.cTop}>
            <Ionicons name="gift-outline" size={26} color="rgba(255,255,255,0.85)" />
            <Text style={styles.cNetwork}>GIFT CARDS</Text>
          </View>
          <View style={styles.cMid}>
            <Ionicons name="gift" size={46} color="rgba(255,255,255,0.12)" />
          </View>
          <View style={styles.cBot}>
            <Text style={styles.cName}>Gift Cards</Text>
            <Text style={styles.cSubInfo}>Store credits & gift cards</Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  // ── Normal Card ──
  const bg = card.color || DS.brandNavy;
  const net = NETWORK_LABEL[card.network] || 'CARD';
  const l4 = card.last_four || '••••';
  const cardAliases = card._aliases || [];

  return (
    <Animated.View style={[styles.cardOuter, { transform: [{ scale }] }]}>
      <View style={[styles.cardFace, shadow, { backgroundColor: bg }]}>
        <View style={styles.cTop}>
          <View style={styles.chipArea}>
            <View style={styles.chip}>
              <View style={styles.chipH} />
              <View style={styles.chipV} />
              <View style={styles.chipTL} />
              <View style={styles.chipBR} />
            </View>
            <Ionicons name="wifi-outline" size={17} color="rgba(255,255,255,0.5)"
              style={{ transform: [{ rotate: '90deg' }], marginLeft: 6 }} />
          </View>
          <Text style={styles.cNetwork}>{net}</Text>
        </View>

        <View style={styles.cMid}>
          <View style={styles.numStack}>
            <Text style={styles.numMask}>••••</Text>
            <Text style={styles.numMask}>••••</Text>
            <Text style={styles.numMask}>••••</Text>
            <Text style={[styles.numMask, styles.numReal]}>{l4}</Text>
          </View>
        </View>

        <View style={styles.cBot}>
          <Text style={styles.cName} numberOfLines={1}>{card.name}</Text>
          {/* Aliases on card */}
          {cardAliases.length > 0 && (
            <View style={styles.cAliasRow}>
              {cardAliases.slice(0, 2).map((a, i) => (
                <View key={i} style={styles.cAliasBadge}>
                  <Ionicons name="phone-portrait-outline" size={9} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.cAliasText}>{a.label} ····{a.last_four}</Text>
                </View>
              ))}
            </View>
          )}
          {/* Tags (only if no aliases showing) */}
          {cardAliases.length === 0 && card.tags?.length > 0 && (
            <View style={styles.cTags}>
              {card.tags.slice(0, 3).map((t, i) => (
                <View key={i} style={styles.cTag}>
                  <Text style={styles.cTagText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
};


// ═════════════════════════════════════════════════════════════
// DETAIL ROW
// ═════════════════════════════════════════════════════════════

const DetailRow = ({ icon, label, value, valueComponent, isLast }) => (
  <View style={[styles.dRow, !isLast && styles.dRowBorder]}>
    <View style={styles.dLeft}>
      <View style={styles.dIcon}>
        <Ionicons name={icon} size={16} color={DS.textSecondary} />
      </View>
      <Text style={styles.dLabel}>{label}</Text>
    </View>
    {valueComponent || <Text style={styles.dValue}>{value}</Text>}
  </View>
);


// ═════════════════════════════════════════════════════════════
// INFO PANEL
// ═════════════════════════════════════════════════════════════

const InfoPanel = ({
  card, isGiftBucket, giftCardCount, receiptCount, lastUsed,
  onEdit, onViewReceipts, onViewGifts, onAddGift,
}) => {
  if (isGiftBucket) {
    return (
      <View style={styles.panel}>
        <View style={styles.panelHead}>
          <Text style={styles.panelName}>GIFT CARDS</Text>
        </View>
        <DetailRow icon="layers-outline" label="Saved gift cards" value={`${giftCardCount}`} />
        <DetailRow icon="receipt-outline" label="Receipts with gift cards" value="—" isLast />
        <View style={styles.btnRow}>
          <TouchableOpacity activeOpacity={0.85} style={[styles.btn, { backgroundColor: DS.accentGold }]} onPress={onViewGifts}>
            <Ionicons name="eye-outline" size={18} color="#fff" />
            <Text style={styles.btnText}>View Cards</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} style={[styles.btn, styles.btnOut]} onPress={onViewReceipts}>
            <Ionicons name="receipt-outline" size={18} color={DS.brandNavy} />
            <Text style={[styles.btnText, { color: DS.brandNavy }]}>View Receipts</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!card) return null;

  const displayName = (card.name || 'CARD').toUpperCase();
  const typeLabel = card.type === 'credit' ? 'Credit' : card.type === 'debit' ? 'Debit' : 'Card';
  const isBusinessCard = card.tags?.includes('business');

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelName}>{displayName}</Text>
        <View style={styles.panelBadgeRow}>
          {/* Personal / Business badge */}
          <View style={[styles.panelBadge, isBusinessCard
            ? { backgroundColor: DS.accentGoldSub }
            : { backgroundColor: DS.bgSurface2 }
          ]}>
            <Ionicons name={isBusinessCard ? "briefcase" : "person"} size={11}
              color={isBusinessCard ? DS.accentGold : DS.brandNavy} />
            <Text style={[styles.panelBadgeText,
              { color: isBusinessCard ? DS.accentGold : DS.brandNavy }
            ]}>{isBusinessCard ? 'BUSINESS' : 'PERSONAL'}</Text>
          </View>
          {/* Type badge */}
          <View style={styles.panelBadge}>
            <Ionicons name="card" size={11} color={DS.brandNavy} />
            <Text style={[styles.panelBadgeText, { color: DS.brandNavy }]}>{typeLabel}</Text>
          </View>
        </View>
      </View>


      <DetailRow icon="receipt-outline" label="Receipts"
        value={`${receiptCount} receipt${receiptCount !== 1 ? 's' : ''}`} />
      <DetailRow icon="time-outline" label="Last used"
        value={lastUsed || 'No transactions yet'} />
      {card.tags?.length > 0 && (
        <DetailRow icon="pricetags-outline" label="Tags" isLast
          valueComponent={
            <View style={styles.tagRow}>
              {card.tags.filter(t => t !== 'personal' && t !== 'business').map((t, i) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{t}</Text>
                </View>
              ))}
              {card.tags.filter(t => t !== 'personal' && t !== 'business').length === 0 && (
                <Text style={styles.dValue}>—</Text>
              )}
            </View>
          } />
      )}
      {(!card.tags || card.tags.length === 0) && (
        <DetailRow icon="pricetags-outline" label="Tags" value="None" isLast />
      )}

      <View style={styles.btnRow}>
        <TouchableOpacity activeOpacity={0.85} style={[styles.btn, { backgroundColor: DS.positive }]} onPress={onEdit}>
          <Icon name="edit-2" size={16} color="#fff" />
          <Text style={styles.btnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} style={[styles.btn, styles.btnOut]} onPress={onViewReceipts}>
          <Ionicons name="receipt-outline" size={16} color={DS.brandNavy} />
          <Text style={[styles.btnText, { color: DS.brandNavy }]}>View Receipts</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};


// ═════════════════════════════════════════════════════════════
// EMPTY STATE
// ═════════════════════════════════════════════════════════════

const EmptyState = ({ onAdd }) => (
  <View style={styles.emptyWrap}>
    <View style={styles.emptyIcon}>
      <Ionicons name="wallet-outline" size={48} color={DS.textSecondary} />
    </View>
    <Text style={styles.emptyTitle}>No cards yet</Text>
    <Text style={styles.emptySub}>
      Save your payment cards to organize{'\n'}receipts by card automatically.
    </Text>
    <TouchableOpacity activeOpacity={0.85} style={styles.emptyCTA} onPress={onAdd}>
      <Ionicons name="add" size={20} color="#fff" />
      <Text style={styles.emptyCTAText}>Add Your First Card</Text>
    </TouchableOpacity>
  </View>
);


// ═════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════

const MyCardsScreen = ({ navigation }) => {
  const [cards, setCards] = useState([]);
  const [aliases, setAliases] = useState({});
  const [aliasDetails, setAliasDetails] = useState({}); // full alias objects per card
  const [giftCardCount, setGiftCardCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);

  const [receiptCounts, setReceiptCounts] = useState({});
  const [lastUsedDates, setLastUsedDates] = useState({});

  // ── Real Supabase fetch ──
  const fetchCards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch saved credit/debit cards
      const { data: pm, error } = await supabase.from('payment_methods').select('*')
        .eq('user_id', user.id).eq('is_active', true).in('type', ['credit', 'debit'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      setCards(pm || []);

      // Fetch all aliases (counts + details)
      const { data: al } = await supabase.from('payment_method_aliases').select('*').eq('user_id', user.id);
      const counts = {}; const details = {};
      (al || []).forEach(a => {
        counts[a.payment_method_id] = (counts[a.payment_method_id] || 0) + 1;
        if (!details[a.payment_method_id]) details[a.payment_method_id] = [];
        details[a.payment_method_id].push(a);
      });
      setAliases(counts);
      setAliasDetails(details);

      // Fetch gift card count
      const { count } = await supabase.from('payment_methods').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_active', true).eq('type', 'gift_card');
      setGiftCardCount(count || 0);

      // Fetch receipt counts and last used dates per card
      const cardIds = (pm || []).map(c => c.id);
      if (cardIds.length > 0) {
        const { data: rpData } = await supabase
          .from('receipt_payments')
          .select('payment_method_id, receipt_id, created_at')
          .in('payment_method_id', cardIds);

        const rCounts = {};
        const rLatest = {};
        (rpData || []).forEach(rp => {
          const pmId = rp.payment_method_id;
          rCounts[pmId] = (rCounts[pmId] || 0) + 1;
          const d = new Date(rp.created_at);
          if (!rLatest[pmId] || d > rLatest[pmId]) rLatest[pmId] = d;
        });
        setReceiptCounts(rCounts);

        // Format last used dates
        const formatted = {};
        Object.entries(rLatest).forEach(([id, date]) => {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          formatted[id] = `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
        });
        setLastUsedDates(formatted);
      } else {
        setReceiptCounts({});
        setLastUsedDates({});
      }

    } catch (err) { console.error('Error fetching cards:', err); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchCards();
  }, [fetchCards]));

  // Attach aliases to cards for display on card face
  const cardsWithAliases = cards.map(c => ({
    ...c,
    _aliases: aliasDetails[c.id] || [],
  }));

  const carouselData = [
    ...cardsWithAliases.map(c => ({ ...c, _type: 'card' })),
    { _type: 'gift_bucket' },
    { _type: 'add_card' },
  ];

  const activeItem = carouselData[activeIndex] || carouselData[0];

  const handleScroll = useCallback((event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SNAP_INTERVAL);
    setActiveIndex(Math.max(0, Math.min(index, carouselData.length - 1)));
  }, [carouselData.length]);

  const goAddCard = () => navigation.navigate('CardDetail');
  const goEditCard = () => activeItem._type === 'card' && navigation.navigate('CardDetail', { card: activeItem });
  const goViewReceipts = () => {
    if (activeItem._type === 'card') {
      navigation.navigate('Receipts', { filterByCard: activeItem });
    } else if (activeItem._type === 'gift_bucket') {
      navigation.navigate('Receipts', { filterByGiftCards: true });
    }
  };
  const goGiftCards = () => navigation.navigate('GiftCards');
  const goAddGift = () => navigation.navigate('AddGiftCard');

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={DS.bgPage} />
        <View style={styles.loadCenter}><ActivityIndicator size="large" color={DS.brandNavy} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={DS.bgPage} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MY CARDS</Text>
        <TouchableOpacity activeOpacity={0.8} style={styles.newPill} onPress={goAddCard}>
          <Ionicons name="add" size={18} color={DS.textPrimary} />
          <Text style={styles.newPillText}>New Card</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {cards.length === 0 ? (
          <EmptyState onAdd={goAddCard} />
        ) : (
          <>
            <View style={styles.carouselBand}>
              <FlatList
                ref={flatListRef}
                data={carouselData}
                horizontal
                snapToInterval={SNAP_INTERVAL}
                snapToAlignment="start"
                decelerationRate="fast"
                onScroll={handleScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingHorizontal: SIDE_PADDING }}
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, i) => item._type === 'card' ? item.id : item._type + i}
                getItemLayout={(_, index) => ({ length: SNAP_INTERVAL, offset: SNAP_INTERVAL * index, index })}
                renderItem={({ item, index }) => (
                  <TouchableOpacity activeOpacity={0.95}
                    style={{ width: CARD_WIDTH, marginRight: CARD_GAP }}
                    onPress={() => {
                      if (item._type === 'add_card') goAddCard();
                      else if (item._type === 'gift_bucket') goGiftCards();
                      else navigation.navigate('CardDetail', { card: item });
                    }}>
                    <WalletCard
                      card={item._type === 'card' ? item : null}
                      isGiftBucket={item._type === 'gift_bucket'}
                      isAddCard={item._type === 'add_card'}
                      isActive={index === activeIndex}
                    />
                  </TouchableOpacity>
                )}
              />
              <View style={styles.dots}>
                {carouselData.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
                ))}
              </View>
            </View>

            {activeItem._type === 'card' && (
              <InfoPanel card={activeItem}
                receiptCount={receiptCounts[activeItem.id] || 0}
                lastUsed={lastUsedDates[activeItem.id] || null}
                onEdit={goEditCard} onViewReceipts={goViewReceipts} />
            )}
            {activeItem._type === 'gift_bucket' && (
              <InfoPanel isGiftBucket giftCardCount={giftCardCount}
                onViewGifts={goGiftCards} onViewReceipts={goViewReceipts} />
            )}
            {activeItem._type === 'add_card' && (
              <View style={styles.panel}>
                <View style={styles.addPanel}>
                  <Ionicons name="card-outline" size={30} color={DS.textSecondary} />
                  <Text style={styles.addPanelTitle}>Add a payment card</Text>
                  <Text style={styles.addPanelSub}>
                    Link your credit or debit card to{'\n'}organize receipts automatically.
                  </Text>
                  <TouchableOpacity activeOpacity={0.85}
                    style={[styles.btn, { backgroundColor: DS.brandNavy, paddingHorizontal: 32, marginTop: 4 }]}
                    onPress={goAddCard}>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.btnText}>Add Card</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};


// ═════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DS.bgPage },
  loadCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: DS.pagePad, paddingTop: 6, paddingBottom: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: DS.bgSurface,
    justifyContent: 'center', alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: DS.textPrimary, letterSpacing: 0.8 },
  newPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
    backgroundColor: DS.bgSurface, borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  newPillText: { fontSize: 14, fontWeight: '600', color: DS.textPrimary },

  // Carousel
  carouselBand: { backgroundColor: DS.bgSurface2 + '80', paddingTop: 24, paddingBottom: 8, marginBottom: 20 },

  // Card
  cardOuter: { height: CARD_HEIGHT },
  cardFace: { flex: 1, borderRadius: 20, padding: 22, justifyContent: 'space-between', overflow: 'hidden' },
  shadowActive: Platform.select({
    ios: { shadowColor: 'rgba(0,0,0,0.3)', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 1, shadowRadius: 24 },
    android: { elevation: 12 },
  }),
  shadowInactive: Platform.select({
    ios: { shadowColor: 'rgba(0,0,0,0.12)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10 },
    android: { elevation: 3 },
  }),

  cTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipArea: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    width: 36, height: 26, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  chipH: { position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  chipV: { position: 'absolute', width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.35)' },
  chipTL: { position: 'absolute', top: 4, left: 4, width: 8, height: 8, borderRadius: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  chipBR: { position: 'absolute', bottom: 4, right: 4, width: 8, height: 8, borderRadius: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  cNetwork: { fontSize: 16, fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: 1.5 },

  cMid: { flex: 1, justifyContent: 'center' },
  numStack: { gap: 2 },
  numMask: { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: 3 },
  numReal: { color: 'rgba(255,255,255,0.9)' },

  cBot: { gap: 6 },
  cName: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3 },
  cSubInfo: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.55)' },
  cTags: { flexDirection: 'row', gap: 5 },
  cTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.18)' },
  cTagText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Aliases on card
  cAliasRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  cAliasBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  cAliasText: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },

  // Add card
  addFace: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: DS.border, shadowColor: 'transparent', elevation: 0 },
  addInner: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  addRing: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: DS.bgSurface2,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: DS.border,
  },
  addTitle: { fontSize: 16, fontWeight: '700', color: DS.textPrimary },
  addSub: { fontSize: 13, color: DS.textSecondary, textAlign: 'center' },

  // Dots
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16, gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: DS.border },
  dotActive: { width: 24, height: 7, borderRadius: 4, backgroundColor: DS.brandNavy },

  // Panel
  panel: {
    marginHorizontal: DS.pagePad, backgroundColor: DS.bgSurface,
    borderRadius: DS.cardRadius, padding: 20, borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 14 },
      android: { elevation: 3 },
    }),
  },
  panelHead: { marginBottom: 16 },
  panelName: { fontSize: 16, fontWeight: '800', color: DS.textPrimary, letterSpacing: 0.8, marginBottom: 10 },
  panelBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  panelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: DS.bgSurface2,
  },
  panelBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  // Detail rows
  dRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15 },
  dRowBorder: { borderBottomWidth: 1, borderBottomColor: DS.bgSurface2 },
  dLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: DS.bgSurface2, justifyContent: 'center', alignItems: 'center' },
  dLabel: { fontSize: 15, fontWeight: '500', color: DS.textSecondary },
  dValue: { fontSize: 15, fontWeight: '700', color: DS.textPrimary },

  // Tags
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  tagChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: DS.accentGoldSub },
  tagChipText: { fontSize: 12, fontWeight: '700', color: DS.accentGold, textTransform: 'capitalize' },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: 16,
  },
  btnOut: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: DS.brandNavy },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Add panel
  addPanel: { alignItems: 'center', gap: 10, paddingVertical: 10 },
  addPanelTitle: { fontSize: 18, fontWeight: '700', color: DS.textPrimary },
  addPanelSub: { fontSize: 14, color: DS.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 100 },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: DS.bgSurface2,
    justifyContent: 'center', alignItems: 'center', marginBottom: 22,
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: DS.textPrimary, marginBottom: 10 },
  emptySub: { fontSize: 15, color: DS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  emptyCTA: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: DS.brandNavy, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 16,
  },
  emptyCTAText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

export default MyCardsScreen;