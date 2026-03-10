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
  Dimensions,
  Image
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/Feather';
import Purchases from 'react-native-purchases';
import { useCredits } from '../context/CreditsContext';
import CreditModal from '../components/CreditModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BillBrainLogo = require('../assets/billbrain.png');

// ─── Design Tokens ───────────────────────────────────────────
const DS = {
  bgPage: '#FAF8F4',
  bgSurface: '#FFFEFB',
  bgSurface2: '#F5F2EC',
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
};

// ─── Plan Data ───────────────────────────────────────────────
const PLANS = {
  essential: {
    id: 'essential',
    name: 'Essential',
    price: '$12.99',
    credits: '100',
    tagline: 'For regular receipt tracking',
    includeLine: 'Includes 100 scans every month',
    accentColor: DS.brandNavy,
    accentLight: DS.brandNavyLight,
    coreBenefits: [
      { icon: 'scan-outline', text: 'Scan & upload receipts' },
      { icon: 'folder-open-outline', text: 'Custom categories & tags' },
      { icon: 'download-outline', text: 'Export to Excel & PDF' },
      { icon: 'card-outline', text: 'Payment card tracking' },
      { icon: 'shield-checkmark-outline', text: 'Secure cloud backup' },
    ],
    premiumExtras: [],
    productId: 'billbrain_essential_monthly',
    packageId: 'essential_monthly',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: '$17.99',
    credits: '250',
    tagline: 'For power users & businesses',
    includeLine: 'Includes 250 scans every month',
    accentColor: DS.accentGold,
    accentLight: DS.accentGoldLight,
    coreBenefits: [
      { icon: 'scan-outline', text: 'Scan & upload receipts' },
      { icon: 'folder-open-outline', text: 'Custom categories & tags' },
      { icon: 'download-outline', text: 'Export to Excel & PDF' },
      { icon: 'card-outline', text: 'Payment card tracking' },
      { icon: 'shield-checkmark-outline', text: 'Secure cloud backup' },
    ],
    premiumExtras: [
      { icon: 'chatbubble-ellipses-outline', text: 'AI Chat assistant' },
      { icon: 'analytics-outline', text: 'Advanced analytics' },
      { icon: 'diamond-outline', text: 'Priority support' },
    ],
    productId: 'billbrain_premium_monthly',
    packageId: 'premium_monthly',
  },
};

const TOPUPS = [
  { credits: 25, price: '$3.99', perCredit: '$0.16/credit', productId: 'billbrain_topup_25', packageId: 'topup_25' },
  { credits: 50, price: '$5.99', perCredit: '$0.12/credit', badge: 'POPULAR', productId: 'billbrain_topup_50', packageId: 'topup_50' },
  { credits: 100, price: '$9.99', perCredit: '$0.09/credit', badge: 'BEST VALUE', productId: 'billbrain_topup_100', packageId: 'topup_100' },
];

const TABS = [
  { key: 'essential', label: 'Essential' },
  { key: 'premium', label: 'Premium' },
  { key: 'topup', label: 'Top-up' },
];

function getTabIndicatorColor(activeTab) {
  if (activeTab === 'premium') return DS.accentGold;
  return DS.brandNavy;
}

// ─── Animated Tab Switcher ───────────────────────────────────
function TabSwitcher({ activeTab, onSelect }) {
  const slideAnim = useRef(new Animated.Value(TABS.findIndex(t => t.key === activeTab))).current;
  const tabWidth = (SCREEN_WIDTH - 48) / 3;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: TABS.findIndex(t => t.key === activeTab),
      tension: 380, friction: 28, useNativeDriver: true,
    }).start();
  }, [activeTab]);

  const indicatorColor = getTabIndicatorColor(activeTab);

  return (
    <View style={styles.tabContainer}>
      <View style={styles.tabTrack}>
        <Animated.View
          style={[styles.tabIndicator, {
            width: tabWidth, backgroundColor: indicatorColor,
            transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1, 2], outputRange: [0, tabWidth, tabWidth * 2] }) }],
          }]}
        />
        {TABS.map((tab) => (
          <TouchableOpacity key={tab.key} style={[styles.tabOption, { width: tabWidth }]} onPress={() => onSelect(tab.key)} activeOpacity={0.8}>
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            {tab.key === 'premium' && activeTab !== 'premium' && (
              <View style={styles.tabStar}><Ionicons name="star" size={8} color={DS.accentGold} /></View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Benefit Row ─────────────────────────────────────────────
function BenefitRow({ icon, text, accentColor, index }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay: index * 40, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, delay: index * 40, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.benefitRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.benefitIcon, { backgroundColor: accentColor + '10' }]}>
        <Ionicons name={icon} size={15} color={accentColor} />
      </View>
      <Text style={styles.benefitText}>{text}</Text>
      <View style={[styles.checkCircle, { backgroundColor: DS.positive + '15' }]}>
        <Ionicons name="checkmark" size={12} color={DS.positive} />
      </View>
    </Animated.View>
  );
}

// ─── Premium Extra Row ───────────────────────────────────────
function PremiumExtraRow({ icon, text, accentColor, index }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay: (index + 5) * 40, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, delay: (index + 5) * 40, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.benefitRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.benefitIcon, { backgroundColor: accentColor + '12' }]}>
        <Ionicons name={icon} size={15} color={accentColor} />
      </View>
      <Text style={[styles.benefitText, { color: accentColor, fontWeight: '600' }]}>{text}</Text>
      <View style={[styles.extraBadge, { backgroundColor: accentColor + '12' }]}>
        <Text style={[styles.extraBadgeText, { color: accentColor }]}>NEW</Text>
      </View>
    </Animated.View>
  );
}

// ─── Top-up Card ─────────────────────────────────────────────
function TopupCard({ item, index, selected, onSelect }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isSelected = selected === index;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => onSelect(index)}
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start()}>
      <Animated.View style={[styles.topupCard, isSelected && styles.topupCardSelected, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.radio, isSelected && styles.radioSelected]}>
          {isSelected && <View style={styles.radioDot} />}
        </View>
        <View style={styles.topupInfo}>
          <View style={styles.topupTitleRow}>
            <Text style={styles.topupCredits}>+{item.credits}</Text>
            <Text style={styles.topupCreditsLabel}>credits</Text>
            {item.badge && (<View style={styles.topupBadge}><Text style={styles.topupBadgeText}>{item.badge}</Text></View>)}
          </View>
          <Text style={styles.topupPerCredit}>{item.perCredit}</Text>
        </View>
        <Text style={[styles.topupPrice, isSelected && styles.topupPriceSelected]}>{item.price}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Safe package finder ─────────────────────────────────────
function findPackage(offering, packageId, productId) {
  if (!offering) return null;
  let pkg = offering.availablePackages.find(p => p.identifier === packageId);
  if (pkg) return pkg;
  pkg = offering.availablePackages.find(p => p.product?.identifier === productId || p.storeProduct?.identifier === productId);
  return pkg || null;
}

// ─── Main PaywallScreen ──────────────────────────────────────
export default function PaywallScreen({ navigation, route }) {
  const initialTab = route?.params?.initialTab || 'premium';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedTopup, setSelectedTopup] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [modal, setModal] = useState({ visible: false, type: 'generic_error', message: '' });
  const { fetchCredits, tierName, isSubscribed } = useCredits();

  const plan = PLANS[activeTab] || PLANS.premium;
  const isTopup = activeTab === 'topup';
  const isPremium = activeTab === 'premium';

  const contentFade = useRef(new Animated.Value(1)).current;
  const contentSlide = useRef(new Animated.Value(0)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 200, friction: 15, useNativeDriver: true }),
    ]).start();
  }, []);

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

  const isCurrentPlan = isSubscribed && (
    (activeTab === 'essential' && tierName === 'Essential') ||
    (activeTab === 'premium' && tierName === 'Premium')
  );

  const closeModal = () => {
    const onDismiss = modal.onDismiss;
    setModal({ visible: false, type: 'generic_error', message: '' });
    onDismiss?.();
  };

  const dismissModal = () => {
    setModal({ visible: false, type: 'generic_error', message: '' });
  };

  // ── Purchase Logic ──
  const handlePurchase = useCallback(async () => {
    if (isCurrentPlan) return;
    try {
      setPurchasing(true);
      const offerings = await Purchases.getOfferings();
      const offering = offerings.current;
      if (!offering) {
        setModal({ visible: true, type: 'generic_error', message: 'No offerings available. Please try again later.' });
        return;
      }

      let pkg;
      if (isTopup) {
        const topup = TOPUPS[selectedTopup];
        pkg = findPackage(offering, topup.packageId, topup.productId);
      } else {
        pkg = findPackage(offering, plan.packageId, plan.productId);
      }

      if (!pkg) {
        setModal({ visible: true, type: 'generic_error', message: 'This package is not available right now.' });
        return;
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);

      if (isTopup) {
        await fetchCredits();
        setModal({
          visible: true, type: 'purchase_success',
          title: 'Credits Added! ⚡',
          message: `+${TOPUPS[selectedTopup].credits} scan credits have been added to your account.`,
          onDismiss: () => navigation.goBack(),
        });
      } else {
        const entitlementId = activeTab === 'premium' ? 'premium_access' : 'essential_access';
        if (customerInfo.entitlements.active[entitlementId]) {
          await fetchCredits();
          setModal({
            visible: true, type: 'purchase_success',
            title: `Welcome to ${plan.name}! 🎉`,
            message: `You now have ${plan.credits} scan credits per month.`,
            onDismiss: () => navigation.goBack(),
          });
        }
      }
    } catch (error) {
      if (!error.userCancelled) {
        setModal({ visible: true, type: 'purchase_error', message: error.message || 'Something went wrong. Please try again.' });
      }
    } finally {
      setPurchasing(false);
    }
  }, [activeTab, selectedTopup, plan, isTopup, isCurrentPlan, fetchCredits, navigation]);

  const handleRestore = useCallback(async () => {
    try {
      setRestoring(true);
      const customerInfo = await Purchases.restorePurchases();
      const hasEssential = customerInfo.entitlements.active['essential_access'];
      const hasPremium = customerInfo.entitlements.active['premium_access'];
      if (hasEssential || hasPremium) {
        await fetchCredits();
        setModal({
          visible: true, type: 'restore_success',
          message: `Your ${hasPremium ? 'Premium' : 'Essential'} subscription has been restored.`,
          onDismiss: () => navigation.goBack(),
        });
      } else {
        setModal({ visible: true, type: 'restore_empty' });
      }
    } catch (error) {
      setModal({ visible: true, type: 'generic_error', title: 'Restore Failed', message: error.message || 'Something went wrong. Please try again.' });
    } finally {
      setRestoring(false);
    }
  }, [fetchCredits, navigation]);

  const getCtaLabel = () => {
    if (isCurrentPlan) return 'Current Plan';
    if (isTopup) return `Buy +${TOPUPS[selectedTopup].credits} — ${TOPUPS[selectedTopup].price}`;
    return `Subscribe — ${plan.price}/mo`;
  };

  const accentColor = isTopup ? DS.brandNavy : plan.accentColor;

  // ── Modal button config ──
  const getModalButtons = () => {
    if (modal.type === 'purchase_success' || modal.type === 'restore_success') {
      return [{ text: "Let's Go", icon: 'checkmark-circle', onPress: closeModal, style: 'gold' }];
    }
    if (modal.type === 'restore_empty') {
      return [{ text: 'OK', onPress: dismissModal, style: 'primary' }];
    }
    return [
      { text: 'Try Again', onPress: dismissModal, style: 'primary' },
      { text: 'Cancel', onPress: dismissModal, style: 'secondary' },
    ];
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="x" size={18} color={DS.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleRestore} activeOpacity={0.7} disabled={restoring} style={styles.restoreBtn}>
          {restoring ? <ActivityIndicator size="small" color={DS.textSecondary} /> : <Text style={styles.restoreText}>Restore Purchases</Text>}
        </TouchableOpacity>
      </View>

      {/* ── Logo + Tagline ── */}
      <Animated.View style={[styles.heroSection, { opacity: headerFade }]}>
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
          <Image source={BillBrainLogo} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>
        <Text style={styles.heroTitle}>Upgrade BillBrain</Text>
        <Text style={styles.heroSubtitle}>Organize your finances effortlessly</Text>
        {isSubscribed && (
          <View style={styles.currentPlanChip}>
            <Ionicons name="checkmark-circle" size={13} color={DS.positive} />
            <Text style={styles.currentPlanChipText}>Current plan: {tierName}</Text>
          </View>
        )}
      </Animated.View>

      {/* ── Tabs ── */}
      <TabSwitcher activeTab={activeTab} onSelect={switchTab} />

      {/* ── Content ── */}
      <Animated.View style={[styles.contentArea, { opacity: contentFade, transform: [{ translateY: contentSlide }] }]}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
          {!isTopup ? (
            <>
              <View style={[styles.priceCard, { borderColor: accentColor + '30' }]}>
                <View style={[styles.priceCardAccent, { backgroundColor: accentColor }]} />
                <View style={styles.priceCardInner}>
                  <View style={styles.planNameRow}>
                    <Text style={[styles.planName, { color: accentColor }]}>{plan.name}</Text>
                    <View style={[styles.planPill, { backgroundColor: accentColor + '12' }]}>
                      <Ionicons name="flash" size={11} color={accentColor} />
                      <Text style={[styles.planPillText, { color: accentColor }]}>{plan.credits}/mo</Text>
                    </View>
                  </View>
                  <Text style={styles.planTagline}>{plan.tagline}</Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceAmount, { color: accentColor }]}>{plan.price}</Text>
                    <View style={styles.pricePerioCol}>
                      <Text style={styles.pricePeriod}>per</Text>
                      <Text style={styles.pricePeriod}>month</Text>
                    </View>
                  </View>
                  <Text style={styles.includeLine}>{plan.includeLine}</Text>
                </View>
              </View>
              <View style={styles.benefitsCard}>
                <Text style={styles.benefitsLabel}>WHAT'S INCLUDED</Text>
                {plan.coreBenefits.map((b, i) => (
                  <BenefitRow key={`${activeTab}-core-${i}`} icon={b.icon} text={b.text} accentColor={accentColor} index={i} />
                ))}
                {plan.premiumExtras.length > 0 && plan.premiumExtras.map((b, i) => (
                  <PremiumExtraRow key={`${activeTab}-extra-${i}`} icon={b.icon} text={b.text} accentColor={accentColor} index={i} />
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.topupIntro}>
                Need a few extra scans?{'\n'}
                <Text style={styles.topupIntroHighlight}>Grab a credit pack — they never expire.</Text>
              </Text>
              {TOPUPS.map((item, index) => (
                <TopupCard key={index} item={item} index={index} selected={selectedTopup} onSelect={setSelectedTopup} />
              ))}
            </>
          )}
          <View style={{ height: 16 }} />
        </ScrollView>
      </Animated.View>

      {/* ── Fixed Bottom ── */}
      <View style={styles.bottomArea}>
        <TouchableOpacity
          style={[styles.subscribeBtn, { backgroundColor: isCurrentPlan ? DS.bgSurface2 : accentColor }, isCurrentPlan && styles.subscribeBtnCurrent, purchasing && styles.subscribeBtnDisabled]}
          onPress={handlePurchase} activeOpacity={isCurrentPlan ? 1 : 0.85} disabled={purchasing || restoring || isCurrentPlan}>
          {purchasing ? (
            <ActivityIndicator size="small" color={isCurrentPlan ? DS.textSecondary : DS.textInverse} />
          ) : (
            <>
              {!isCurrentPlan && <Ionicons name="flash" size={16} color={DS.textInverse} style={{ marginRight: 8 }} />}
              <Text style={[styles.subscribeBtnText, isCurrentPlan && styles.subscribeBtnTextCurrent]}>{getCtaLabel()}</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.termsText}>{isTopup ? 'One-time purchase · Credits never expire' : 'Cancel anytime · Billed monthly'}</Text>
        {!isTopup && (
          <View style={styles.termsLinks}>
            <TouchableOpacity activeOpacity={0.6}><Text style={styles.termLink}>Terms of Use</Text></TouchableOpacity>
            <Text style={styles.termsDot}>·</Text>
            <TouchableOpacity activeOpacity={0.6}><Text style={styles.termLink}>Privacy Policy</Text></TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── CreditModal ── */}
      <CreditModal
        visible={modal.visible}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onClose={closeModal}
        buttons={getModalButtons()}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 4 },  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: DS.bgSurface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: DS.border },
  restoreBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: DS.bgSurface2, borderRadius: 20 },
  restoreText: { fontSize: 13, fontWeight: '600', color: DS.textSecondary },
  heroSection: { alignItems: 'center', paddingTop: 0, paddingBottom: 10 },
  logoContainer: { marginBottom: 2, position: 'relative' },
  logoImage: { width: 72, height: 72, borderRadius: 22 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.5, marginBottom: 3 },
  heroSubtitle: { fontSize: 14, fontWeight: '400', color: DS.textSecondary },
  currentPlanChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.positive + '10', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, gap: 5, marginTop: 8 },
  currentPlanChipText: { fontSize: 12, fontWeight: '600', color: DS.positive },
  tabContainer: { paddingHorizontal: 20, marginBottom: 14 },
  tabTrack: { flexDirection: 'row', backgroundColor: DS.bgSurface2, borderRadius: 14, padding: 3, position: 'relative' },
  tabIndicator: { position: 'absolute', top: 3, left: 3, height: '100%', borderRadius: 12, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 }, android: { elevation: 4 } }) },
  tabOption: { alignItems: 'center', justifyContent: 'center', paddingVertical: 11, flexDirection: 'row', zIndex: 1, gap: 4 },
  tabText: { fontSize: 13, fontWeight: '600', color: DS.textSecondary },
  tabTextActive: { color: DS.textInverse },
  tabStar: { width: 14, height: 14, borderRadius: 7, backgroundColor: DS.accentGoldSub, alignItems: 'center', justifyContent: 'center' },
  contentArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 2 },
  priceCard: { backgroundColor: DS.bgSurface, borderRadius: 22, borderWidth: 1.5, overflow: 'hidden', marginBottom: 14, ...Platform.select({ ios: { shadowColor: DS.brandNavy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 20 }, android: { elevation: 3 } }) },
  priceCardAccent: { height: 4, width: '100%' },
  priceCardInner: { padding: 22 },
  planNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  planName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  planPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 4 },
  planPillText: { fontSize: 12, fontWeight: '700' },
  planTagline: { fontSize: 13, fontWeight: '400', color: DS.textSecondary, marginBottom: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  priceAmount: { fontSize: 46, fontWeight: '800', letterSpacing: -2, lineHeight: 48 },
  pricePerioCol: { marginBottom: 6 },
  pricePeriod: { fontSize: 13, fontWeight: '500', color: DS.textSecondary, lineHeight: 16 },
  includeLine: { fontSize: 12, fontWeight: '700', color: DS.textSecondary, marginTop: 8 },
  benefitsCard: { backgroundColor: DS.bgSurface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: DS.border },
  benefitsLabel: { fontSize: 11, fontWeight: '700', color: DS.textMuted, letterSpacing: 1.2, marginBottom: 10 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 },
  benefitIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  benefitText: { flex: 1, fontSize: 14, fontWeight: '500', color: DS.textPrimary },
  checkCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  extraBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  extraBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  topupIntro: { fontSize: 15, fontWeight: '400', color: DS.textSecondary, lineHeight: 22, marginBottom: 18 },
  topupIntroHighlight: { fontWeight: '600', color: DS.textPrimary },
  topupCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.bgSurface, borderRadius: 18, padding: 18, marginBottom: 10, borderWidth: 1.5, borderColor: DS.border, gap: 14 },
  topupCardSelected: { borderColor: DS.brandNavy, ...Platform.select({ ios: { shadowColor: DS.brandNavy, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 12 }, android: { elevation: 3 } }) },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: DS.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderWidth: 2, borderColor: DS.brandNavy },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: DS.brandNavy },
  topupInfo: { flex: 1 },
  topupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  topupCredits: { fontSize: 18, fontWeight: '700', color: DS.textPrimary },
  topupCreditsLabel: { fontSize: 14, fontWeight: '500', color: DS.textSecondary },
  topupBadge: { backgroundColor: DS.accentGoldSub, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  topupBadgeText: { fontSize: 8, fontWeight: '800', color: DS.accentGold, letterSpacing: 0.5 },
  topupPerCredit: { fontSize: 12, fontWeight: '400', color: DS.textSecondary },
  topupPrice: { fontSize: 18, fontWeight: '700', color: DS.textSecondary },
  topupPriceSelected: { color: DS.brandNavy },
  bottomArea: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 8 : 20, backgroundColor: DS.bgPage, borderTopWidth: 1, borderTopColor: DS.border + '60' },
  subscribeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: 28, ...Platform.select({ ios: { shadowColor: DS.brandNavy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16 }, android: { elevation: 6 } }) },
  subscribeBtnDisabled: { opacity: 0.7 },
  subscribeBtnCurrent: { borderWidth: 1.5, borderColor: DS.border, ...Platform.select({ ios: { shadowOpacity: 0 }, android: { elevation: 0 } }) },
  subscribeBtnText: { fontSize: 15, fontWeight: '700', color: DS.textInverse, letterSpacing: 0.2 },
  subscribeBtnTextCurrent: { color: DS.textSecondary },
  termsText: { textAlign: 'center', fontSize: 11, fontWeight: '400', color: DS.textMuted, marginTop: 10 },
  termsLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  termLink: { fontSize: 11, fontWeight: '500', color: DS.textSecondary, textDecorationLine: 'underline' },
  termsDot: { fontSize: 11, color: DS.textMuted },
});