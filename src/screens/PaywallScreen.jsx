import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/Feather';
import Purchases from 'react-native-purchases';
import { useCredits } from '../context/CreditsContext';
import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Design Tokens ───────────────────────────────────────────
const DS = {
  bgPage: '#FAF8F4',
  bgSurface: '#FFFEFB',
  bgSurface2: '#F5F2EC',
  bgDark: '#0F1923',
  brandNavy: '#1A3A6B',
  brandNavyLight: '#2A5090',
  accentGold: '#E8A020',
  accentGoldLight: '#F4BC5C',
  accentGoldSub: '#FEF3DC',
  textPrimary: '#1C1610',
  textSecondary: '#8A7E72',
  textMuted: '#B8B0A4',
  textInverse: '#FFFEFB',
  positive: '#2A8C5C',
  border: '#EDE8E0',
  borderLight: '#F5F2EC',
};

// ─── Plan Data ───────────────────────────────────────────────
const PLANS = {
  essential: {
    id: 'essential',
    name: 'Essential',
    price: '$8.99',
    credits: '100',
    tagline: 'For regular receipt tracking',
    accentColor: DS.brandNavy,
    accentLight: DS.brandNavyLight,
    gradientStart: '#1A3A6B',
    gradientEnd: '#2A5090',
    benefits: [
      { icon: 'scan-outline', text: 'Scan & upload receipts', highlight: false },
      { icon: 'folder-open-outline', text: 'Custom categories & tags', highlight: false },
      { icon: 'download-outline', text: 'Export to Excel & PDF', highlight: false },
      { icon: 'card-outline', text: 'Payment card tracking', highlight: false },
      { icon: 'shield-checkmark-outline', text: 'Secure cloud backup', highlight: false },
    ],
    packageId: 'essential_monthly',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: '$12.99',
    credits: '250',
    tagline: 'For power users & businesses',
    accentColor: DS.accentGold,
    accentLight: DS.accentGoldLight,
    gradientStart: '#E8A020',
    gradientEnd: '#D4901A',
    benefits: [
      { icon: 'scan-outline', text: 'Scan & upload receipts', highlight: false },
      { icon: 'folder-open-outline', text: 'Custom categories & tags', highlight: false },
      { icon: 'download-outline', text: 'Export to Excel & PDF', highlight: false },
      { icon: 'card-outline', text: 'Payment card tracking', highlight: false },
      { icon: 'shield-checkmark-outline', text: 'Secure cloud backup', highlight: false },
      { icon: 'chatbubble-ellipses-outline', text: 'AI Chat assistant', highlight: true },
      { icon: 'analytics-outline', text: 'Advanced analytics', highlight: true },
      { icon: 'diamond-outline', text: 'Priority support', highlight: true },
    ],
    packageId: 'premium_monthly',
  },
};

const TOPUPS = [
  { credits: 25, price: '$2.99', perCredit: '$0.12/credit', packageId: 'topup_25' },
  { credits: 50, price: '$4.99', perCredit: '$0.10/credit', badge: 'POPULAR', packageId: 'topup_50' },
  { credits: 100, price: '$7.99', perCredit: '$0.08/credit', badge: 'BEST VALUE', packageId: 'topup_100' },
];

const TABS = [
  { key: 'essential', label: 'Essential' },
  { key: 'premium', label: 'Premium' },
  { key: 'topup', label: 'Top-up' },
];

// ─── Animated Tab Switcher ───────────────────────────────────
function TabSwitcher({ activeTab, onSelect }) {
  const slideAnim = useRef(new Animated.Value(TABS.findIndex(t => t.key === activeTab))).current;
  const tabWidth = (SCREEN_WIDTH - 48) / 3;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: TABS.findIndex(t => t.key === activeTab),
      tension: 380,
      friction: 28,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

  return (
    <View style={[styles.tabContainer, { marginHorizontal: 4 }]}>
      <View style={styles.tabTrack}>
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              width: tabWidth,
              transform: [{
                translateX: slideAnim.interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: [0, tabWidth, tabWidth * 2],
                }),
              }],
            },
          ]}
        />
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabOption, { width: tabWidth }]}
            onPress={() => onSelect(tab.key)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.tabText,
              activeTab === tab.key && styles.tabTextActive,
            ]}>
              {tab.label}
            </Text>
            {tab.key === 'premium' && activeTab !== 'premium' && (
              <View style={styles.tabStar}>
                <Ionicons name="star" size={8} color={DS.accentGold} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Benefit Row ─────────────────────────────────────────────
function BenefitRow({ icon, text, highlight, accentColor, index }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[
      styles.benefitRow,
      {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      },
    ]}>
      <View style={[styles.benefitIcon, { backgroundColor: accentColor + '10' }]}>
        <Ionicons name={icon} size={15} color={accentColor} />
      </View>
      <Text style={[styles.benefitText, highlight && { color: accentColor, fontWeight: '600' }]}>
        {text}
      </Text>
      {highlight && (
        <View style={[styles.newBadge, { backgroundColor: accentColor + '15' }]}>
          <Text style={[styles.newBadgeText, { color: accentColor }]}>NEW</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Top-up Card ─────────────────────────────────────────────
function TopupCard({ item, index, selected, onSelect }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isSelected = selected === index;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onSelect(index)}
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start()}
    >
      <Animated.View style={[
        styles.topupCard,
        isSelected && styles.topupCardSelected,
        { transform: [{ scale: scaleAnim }] },
      ]}>
        {/* Radio */}
        <View style={[styles.radio, isSelected && styles.radioSelected]}>
          {isSelected && <View style={styles.radioDot} />}
        </View>

        {/* Info */}
        <View style={styles.topupInfo}>
          <View style={styles.topupTitleRow}>
            <Text style={styles.topupCredits}>+{item.credits}</Text>
            <Text style={styles.topupCreditsLabel}>credits</Text>
            {item.badge && (
              <View style={styles.topupBadge}>
                <Text style={styles.topupBadgeText}>{item.badge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.topupPerCredit}>{item.perCredit}</Text>
        </View>

        {/* Price */}
        <Text style={[styles.topupPrice, isSelected && styles.topupPriceSelected]}>
          {item.price}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main PaywallScreen ──────────────────────────────────────
export default function PaywallScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('premium');
  const [selectedTopup, setSelectedTopup] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const { fetchCredits, tierName, isSubscribed } = useCredits();

  const plan = PLANS[activeTab] || PLANS.premium;
  const isTopup = activeTab === 'topup';
  const isPremium = activeTab === 'premium';

  const contentFade = useRef(new Animated.Value(1)).current;
  const contentSlide = useRef(new Animated.Value(0)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  // Entry animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 200, friction: 15, useNativeDriver: true }),
    ]).start();
  }, []);

  // Tab switch animation
  const switchTab = (tab) => {
    if (tab === activeTab) return;
    Animated.parallel([
      Animated.timing(contentFade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(contentSlide, { toValue: -8, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setActiveTab(tab);
      contentSlide.setValue(8);
      Animated.parallel([
        Animated.timing(contentFade, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(contentSlide, { toValue: 0, tension: 300, friction: 25, useNativeDriver: true }),
      ]).start();
    });
  };

  // ── Purchase Logic ──
  const handlePurchase = useCallback(async () => {
    try {
      setPurchasing(true);
      const offerings = await Purchases.getOfferings();
      const offering = offerings.current;
      if (!offering) {
        Alert.alert('Error', 'No offerings available. Please try again later.');
        return;
      }

      let pkg;
      if (isTopup) {
        const topup = TOPUPS[selectedTopup];
        pkg = offering.availablePackages.find(p => p.identifier === topup.packageId);
      } else {
        pkg = offering.availablePackages.find(p => p.identifier === plan.packageId);
      }

      if (!pkg) {
        Alert.alert('Error', 'This package is not available right now.');
        return;
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);

      if (isTopup) {
        await fetchCredits();
        Alert.alert(
          'Credits Added! ⚡',
          `+${TOPUPS[selectedTopup].credits} scan credits have been added to your account.`,
          [{ text: 'Great', onPress: () => navigation.goBack() }]
        );
      } else {
        const entitlementId = activeTab === 'premium' ? 'premium_access' : 'essential_access';
        if (customerInfo.entitlements.active[entitlementId]) {
          await fetchCredits();
          Alert.alert(
            `Welcome to ${plan.name}! 🎉`,
            `You now have ${plan.credits} scan credits per month.`,
            [{ text: "Let's Go", onPress: () => navigation.goBack() }]
          );
        }
      }
    } catch (error) {
      if (!error.userCancelled) {
        Alert.alert('Purchase Failed', error.message || 'Something went wrong.');
      }
    } finally {
      setPurchasing(false);
    }
  }, [activeTab, selectedTopup, plan, isTopup, fetchCredits, navigation]);

  const handleRestore = useCallback(async () => {
    try {
      setRestoring(true);
      const customerInfo = await Purchases.restorePurchases();
      const hasEssential = customerInfo.entitlements.active['essential_access'];
      const hasPremium = customerInfo.entitlements.active['premium_access'];

      if (hasEssential || hasPremium) {
        await fetchCredits();
        Alert.alert(
          'Purchases Restored',
          `Your ${hasPremium ? 'Premium' : 'Essential'} subscription has been restored.`,
          [{ text: 'Great', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('No Purchases Found', "We couldn't find any previous purchases to restore.");
      }
    } catch (error) {
      Alert.alert('Restore Failed', error.message || 'Something went wrong.');
    } finally {
      setRestoring(false);
    }
  }, [fetchCredits, navigation]);

  // ── Button label ──
  const getButtonLabel = () => {
    if (isTopup) return `Buy +${TOPUPS[selectedTopup].credits} Credits — ${TOPUPS[selectedTopup].price}`;
    return `Subscribe to ${plan.name} — ${plan.price}/mo`;
  };

  const accentColor = isTopup ? DS.brandNavy : plan.accentColor;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="x" size={18} color={DS.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleRestore} activeOpacity={0.7} disabled={restoring} style={styles.restoreBtn}>
          {restoring ? (
            <ActivityIndicator size="small" color={DS.textSecondary} />
          ) : (
            <Text style={styles.restoreText}>Restore</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Logo + Tagline ── */}
      <Animated.View style={[styles.heroSection, { opacity: headerFade }]}>
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoGlow} />
          <View style={styles.logoBox}>
            <Ionicons name="receipt-outline" size={26} color={DS.textInverse} />
          </View>
        </Animated.View>
        <Text style={styles.heroTitle}>Unlock BillBrain</Text>
        <Text style={styles.heroSubtitle}>Scan more receipts. Save more time.</Text>
      </Animated.View>

      {/* ── Tabs ── */}
      <TabSwitcher activeTab={activeTab} onSelect={switchTab} />

      {/* ── Content ── */}
      <Animated.View style={[
        styles.contentArea,
        {
          opacity: contentFade,
          transform: [{ translateY: contentSlide }],
        },
      ]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {!isTopup ? (
            /* ── Subscription View ── */
            <>
              {/* Price Card */}
              <View style={[
                styles.priceCard,
                { borderColor: accentColor + '30' },
              ]}>
                {/* Top accent line */}
                <View style={[styles.priceCardAccent, { backgroundColor: accentColor }]} />

                <View style={styles.priceCardInner}>
                  {/* Plan name + tagline */}
                  <View style={styles.planNameRow}>
                    <Text style={[styles.planName, { color: accentColor }]}>{plan.name}</Text>
                    <View style={[styles.planPill, { backgroundColor: accentColor + '12' }]}>
                      <Ionicons name="flash" size={11} color={accentColor} />
                      <Text style={[styles.planPillText, { color: accentColor }]}>{plan.credits} credits/mo</Text>
                    </View>
                  </View>
                  <Text style={styles.planTagline}>{plan.tagline}</Text>

                  {/* Price */}
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceAmount, { color: accentColor }]}>{plan.price}</Text>
                    <View style={styles.pricePerioCol}>
                      <Text style={styles.pricePeriod}>per</Text>
                      <Text style={styles.pricePeriod}>month</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Benefits */}
              <View style={styles.benefitsCard}>
                <Text style={styles.benefitsLabel}>WHAT'S INCLUDED</Text>
                {plan.benefits.map((b, i) => (
                  <BenefitRow
                    key={`${activeTab}-${i}`}
                    icon={b.icon}
                    text={b.text}
                    highlight={b.highlight}
                    accentColor={accentColor}
                    index={i}
                  />
                ))}
              </View>
            </>
          ) : (
            /* ── Top-up View ── */
            <>
              <Text style={styles.topupIntro}>
                Need a few extra scans? Grab a credit pack.{'\n'}
                <Text style={styles.topupIntroHighlight}>They never expire.</Text>
              </Text>
              {TOPUPS.map((item, index) => (
                <TopupCard
                  key={index}
                  item={item}
                  index={index}
                  selected={selectedTopup}
                  onSelect={setSelectedTopup}
                />
              ))}
            </>
          )}
          {/* Bottom spacer for button */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </Animated.View>

      {/* ── Fixed Bottom ── */}
      <View style={styles.bottomArea}>
        <TouchableOpacity
          style={[
            styles.subscribeBtn,
            { backgroundColor: accentColor },
            purchasing && styles.subscribeBtnDisabled,
          ]}
          onPress={handlePurchase}
          activeOpacity={0.85}
          disabled={purchasing || restoring}
        >
          {purchasing ? (
            <ActivityIndicator size="small" color={DS.textInverse} />
          ) : (
            <>
              <Ionicons name="flash" size={16} color={DS.textInverse} style={{ marginRight: 8 }} />
              <Text style={styles.subscribeBtnText}>{getButtonLabel()}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.termsText}>
          {isTopup
            ? 'One-time purchase · Credits never expire'
            : 'Cancel anytime · Billed monthly'
          }
        </Text>
        {!isTopup && (
          <View style={styles.termsLinks}>
            <TouchableOpacity activeOpacity={0.6}>
              <Text style={styles.termLink}>Terms of Use</Text>
            </TouchableOpacity>
            <Text style={styles.termsDot}>·</Text>
            <TouchableOpacity activeOpacity={0.6}>
              <Text style={styles.termLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DS.bgPage,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: DS.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DS.border,
  },
  restoreBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  restoreText: {
    fontSize: 13,
    fontWeight: '500',
    color: DS.textSecondary,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 16,
  },
  logoContainer: {
    marginBottom: 12,
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DS.brandNavy + '15',
    top: -4,
    left: -4,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: DS.brandNavy,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: DS.brandNavy,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: DS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: DS.textSecondary,
  },

  // Tabs
  tabContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: DS.bgSurface2,
    borderRadius: 14,
    padding: 3,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    height: '100%',
    backgroundColor: DS.brandNavy,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: DS.brandNavy,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  tabOption: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    flexDirection: 'row',
    zIndex: 1,
    gap: 4,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.textSecondary,
  },
  tabTextActive: {
    color: DS.textInverse,
  },
  tabStar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: DS.accentGoldSub,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  contentArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 2,
  },

  // Price Card
  priceCard: {
    backgroundColor: DS.bgSurface,
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: DS.brandNavy,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
      },
      android: { elevation: 3 },
    }),
  },
  priceCardAccent: {
    height: 4,
    width: '100%',
  },
  priceCardInner: {
    padding: 22,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  planName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  planPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  planPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  planTagline: {
    fontSize: 13,
    fontWeight: '400',
    color: DS.textSecondary,
    marginBottom: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  priceAmount: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 50,
  },
  pricePerioCol: {
    marginBottom: 6,
  },
  pricePeriod: {
    fontSize: 13,
    fontWeight: '500',
    color: DS.textMuted,
    lineHeight: 16,
  },

  // Benefits
  benefitsCard: {
    backgroundColor: DS.bgSurface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: DS.border,
  },
  benefitsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: DS.textMuted,
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: DS.textPrimary,
  },
  newBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Top-up
  topupIntro: {
    fontSize: 15,
    fontWeight: '400',
    color: DS.textSecondary,
    lineHeight: 22,
    marginBottom: 18,
  },
  topupIntroHighlight: {
    fontWeight: '600',
    color: DS.textPrimary,
  },
  topupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.bgSurface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: DS.border,
    gap: 14,
  },
  topupCardSelected: {
    borderColor: DS.brandNavy,
    backgroundColor: DS.bgSurface,
    ...Platform.select({
      ios: {
        shadowColor: DS.brandNavy,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: DS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderWidth: 2,
    borderColor: DS.brandNavy,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: DS.brandNavy,
  },
  topupInfo: {
    flex: 1,
  },
  topupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  topupCredits: {
    fontSize: 18,
    fontWeight: '700',
    color: DS.textPrimary,
  },
  topupCreditsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: DS.textSecondary,
  },
  topupBadge: {
    backgroundColor: DS.accentGoldSub,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topupBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: DS.accentGold,
    letterSpacing: 0.5,
  },
  topupPerCredit: {
    fontSize: 12,
    fontWeight: '400',
    color: DS.textMuted,
  },
  topupPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: DS.textSecondary,
  },
  topupPriceSelected: {
    color: DS.brandNavy,
  },

  // Bottom fixed area
  bottomArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
    backgroundColor: DS.bgPage,
    borderTopWidth: 1,
    borderTopColor: DS.border + '80',
  },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    ...Platform.select({
      ios: {
        shadowColor: DS.brandNavy,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  subscribeBtnDisabled: {
    opacity: 0.7,
  },
  subscribeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: DS.textInverse,
    letterSpacing: 0.2,
  },
  termsText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '400',
    color: DS.textMuted,
    marginTop: 10,
  },
  termsLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  termLink: {
    fontSize: 11,
    fontWeight: '500',
    color: DS.textSecondary,
    textDecorationLine: 'underline',
  },
  termsDot: {
    fontSize: 11,
    color: DS.textMuted,
  },
});