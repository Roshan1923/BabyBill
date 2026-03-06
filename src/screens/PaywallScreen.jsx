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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/Feather';
import Purchases from 'react-native-purchases';
import { useCredits } from '../context/CreditsContext';

// ─── Design Tokens ───────────────────────────────────────────
const DS = {
  bgPage: '#FAF8F4',
  bgSurface: '#FFFEFB',
  bgSurface2: '#F5F2EC',
  brandNavy: '#1A3A6B',
  accentGold: '#E8A020',
  accentGoldSub: '#FEF3DC',
  textPrimary: '#1C1610',
  textSecondary: '#8A7E72',
  textInverse: '#FFFEFB',
  positive: '#2A8C5C',
  negative: '#C8402A',
  border: '#EDE8E0',
  shadow: 'rgba(26,58,107,0.10)',
};

// ─── Plan Data ───────────────────────────────────────────────
const PLANS = {
  essential: {
    id: 'essential',
    name: 'Essential',
    price: '$8.99',
    period: '/month',
    credits: '100',
    tagline: 'For regular receipt tracking',
    color: DS.brandNavy,
    features: [
      { icon: 'scan-outline', text: '100 scan credits/month', included: true },
      { icon: 'cloud-upload-outline', text: 'Upload & scan receipts', included: true },
      { icon: 'folder-outline', text: 'Custom categories', included: true },
      { icon: 'download-outline', text: 'Export to Excel', included: true },
      { icon: 'card-outline', text: 'Payment card tracking', included: true },
      { icon: 'chatbubble-ellipses-outline', text: 'AI Chat assistant', included: false },
      { icon: 'analytics-outline', text: 'Advanced analytics', included: false },
      { icon: 'people-outline', text: 'Priority support', included: false },
    ],
    packageId: 'essential_monthly',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: '$12.99',
    period: '/month',
    credits: '250',
    tagline: 'For power users & businesses',
    color: DS.accentGold,
    badge: 'BEST VALUE',
    features: [
      { icon: 'scan-outline', text: '250 scan credits/month', included: true },
      { icon: 'cloud-upload-outline', text: 'Upload & scan receipts', included: true },
      { icon: 'folder-outline', text: 'Custom categories', included: true },
      { icon: 'download-outline', text: 'Export to Excel', included: true },
      { icon: 'card-outline', text: 'Payment card tracking', included: true },
      { icon: 'chatbubble-ellipses-outline', text: 'AI Chat assistant', included: true },
      { icon: 'analytics-outline', text: 'Advanced analytics', included: true },
      { icon: 'people-outline', text: 'Priority support', included: true },
    ],
    packageId: 'premium_monthly',
  },
};

// ─── Toggle Component ────────────────────────────────────────
function PlanToggle({ selected, onSelect }) {
  const slideAnim = useRef(new Animated.Value(selected === 'essential' ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selected === 'essential' ? 0 : 1,
      tension: 300,
      friction: 25,
      useNativeDriver: true,
    }).start();
  }, [selected]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1], // Will be calculated based on layout
  });

  return (
    <View style={styles.toggleContainer}>
      <View style={styles.toggleTrack}>
        <Animated.View
          style={[
            styles.toggleSlider,
            {
              transform: [{
                translateX: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [2, (styles.toggleTrack.width || 280) / 2 - 2],
                }),
              }],
            },
          ]}
        />
        <TouchableOpacity
          style={styles.toggleOption}
          onPress={() => onSelect('essential')}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.toggleText,
            selected === 'essential' && styles.toggleTextActive,
          ]}>
            Essential
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toggleOption}
          onPress={() => onSelect('premium')}
          activeOpacity={0.8}
        >
          <View style={styles.togglePremiumWrap}>
            <Text style={[
              styles.toggleText,
              selected === 'premium' && styles.toggleTextActive,
            ]}>
              Premium
            </Text>
            {selected !== 'premium' && (
              <View style={styles.toggleBadge}>
                <Text style={styles.toggleBadgeText}>BEST</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Feature Row ─────────────────────────────────────────────
function FeatureRow({ icon, text, included, accentColor }) {
  return (
    <View style={styles.featureRow}>
      <View style={[
        styles.featureIconBox,
        { backgroundColor: included ? (accentColor + '15') : '#F5F2EC' },
      ]}>
        <Ionicons
          name={icon}
          size={16}
          color={included ? accentColor : '#C8C2B8'}
        />
      </View>
      <Text style={[
        styles.featureText,
        !included && styles.featureTextDisabled,
      ]}>
        {text}
      </Text>
      <Ionicons
        name={included ? 'checkmark-circle' : 'close-circle'}
        size={18}
        color={included ? DS.positive : '#D4CFC7'}
      />
    </View>
  );
}

// ─── Main PaywallScreen ──────────────────────────────────────
export default function PaywallScreen({ navigation }) {
  const [selectedPlan, setSelectedPlan] = useState('premium');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const { fetchCredits, tierName, isSubscribed } = useCredits();

  const plan = PLANS[selectedPlan];
  const cardScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Animate card on plan switch
  useEffect(() => {
    Animated.sequence([
      Animated.timing(cardScale, { toValue: 0.97, duration: 100, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, tension: 300, friction: 20, useNativeDriver: true }),
    ]).start();
  }, [selectedPlan]);

  const handlePurchase = useCallback(async () => {
    try {
      setPurchasing(true);

      // Get offerings from RevenueCat
      const offerings = await Purchases.getOfferings();
      const offering = offerings.current;

      if (!offering) {
        Alert.alert('Error', 'No offerings available. Please try again later.');
        return;
      }

      // Find the package matching the selected plan
      const pkg = offering.availablePackages.find(
        (p) => p.identifier === plan.packageId
      );

      if (!pkg) {
        Alert.alert('Error', `${plan.name} plan is not available right now.`);
        return;
      }

      // Purchase the package
      const { customerInfo } = await Purchases.purchasePackage(pkg);

      // Check if entitlement is now active
      const entitlementId = selectedPlan === 'premium' ? 'premium_access' : 'essential_access';
      if (customerInfo.entitlements.active[entitlementId]) {
        // Refresh credits from backend (webhook should have updated by now)
        await fetchCredits();

        Alert.alert(
          'Welcome to ' + plan.name + '! 🎉',
          `You now have ${plan.credits} scan credits per month.`,
          [{ text: 'Let\'s Go', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      if (!error.userCancelled) {
        Alert.alert('Purchase Failed', error.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  }, [selectedPlan, plan, fetchCredits, navigation]);

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
        Alert.alert('No Purchases Found', 'We couldn\'t find any previous purchases to restore.');
      }
    } catch (error) {
      Alert.alert('Restore Failed', error.message || 'Something went wrong. Please try again.');
    } finally {
      setRestoring(false);
    }
  }, [fetchCredits, navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Icon name="arrow-left" size={20} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* Current plan badge */}
          {isSubscribed ? (
            <View style={styles.currentPlanBadge}>
              <Ionicons name="checkmark-circle" size={14} color={DS.positive} />
              <Text style={styles.currentPlanText}>
                You're on {tierName}
              </Text>
            </View>
          ) : (
            <View style={styles.currentPlanBadge}>
              <Ionicons name="flash-outline" size={14} color={DS.accentGold} />
              <Text style={styles.currentPlanText}>
                Upgrade for more scans
              </Text>
            </View>
          )}

          {/* Toggle */}
          <PlanToggle selected={selectedPlan} onSelect={setSelectedPlan} />

          {/* Plan Card */}
          <Animated.View style={[styles.planCard, { transform: [{ scale: cardScale }] }]}>
            {/* Plan badge */}
            {plan.badge && (
              <View style={[styles.planBadge, { backgroundColor: plan.color }]}>
                <Text style={styles.planBadgeText}>{plan.badge}</Text>
              </View>
            )}

            {/* Price section */}
            <View style={styles.priceSection}>
              <View style={styles.priceRow}>
                <Text style={[styles.priceAmount, { color: plan.color }]}>
                  {plan.price}
                </Text>
                <Text style={styles.pricePeriod}>{plan.period}</Text>
              </View>
              <Text style={styles.planTagline}>{plan.tagline}</Text>
            </View>

            {/* Credits highlight */}
            <View style={[styles.creditsHighlight, { backgroundColor: plan.color + '10' }]}>
              <Ionicons name="flash" size={20} color={plan.color} />
              <View style={styles.creditsTextWrap}>
                <Text style={[styles.creditsNumber, { color: plan.color }]}>
                  {plan.credits}
                </Text>
                <Text style={styles.creditsLabel}>scan credits/month</Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Features */}
            <Text style={styles.featuresTitle}>What's included</Text>
            {plan.features.map((feature, index) => (
              <FeatureRow
                key={index}
                icon={feature.icon}
                text={feature.text}
                included={feature.included}
                accentColor={plan.color}
              />
            ))}
          </Animated.View>

          {/* Subscribe button */}
          <TouchableOpacity
            style={[
              styles.subscribeBtn,
              { backgroundColor: plan.color },
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
                <Ionicons name="flash" size={18} color={DS.textInverse} style={{ marginRight: 8 }} />
                <Text style={styles.subscribeBtnText}>
                  Subscribe to {plan.name}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Cancel anytime note */}
          <Text style={styles.cancelNote}>
            Cancel anytime. Billed monthly.
          </Text>

          {/* Top-up link */}
          <TouchableOpacity
            style={styles.topupLink}
            activeOpacity={0.7}
            onPress={() => {
              // TODO: navigate to top-up screen or show bottom sheet
              Alert.alert('Top-ups', 'Credit top-up packs coming soon.');
            }}
          >
            <Ionicons name="add-circle-outline" size={16} color={DS.brandNavy} />
            <Text style={styles.topupLinkText}>
              Just need a few scans? Buy credit packs
            </Text>
          </TouchableOpacity>

          {/* Restore purchases */}
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            activeOpacity={0.7}
            disabled={purchasing || restoring}
          >
            {restoring ? (
              <ActivityIndicator size="small" color={DS.textSecondary} />
            ) : (
              <Text style={styles.restoreText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const TOGGLE_WIDTH = 280;

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
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: DS.textPrimary,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Current plan badge
  currentPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: DS.bgSurface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: DS.border,
  },
  currentPlanText: {
    fontSize: 13,
    fontWeight: '500',
    color: DS.textSecondary,
  },

  // Toggle
  toggleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  toggleTrack: {
    width: TOGGLE_WIDTH,
    height: 48,
    backgroundColor: DS.bgSurface,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderWidth: 1,
    borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  toggleSlider: {
    position: 'absolute',
    width: TOGGLE_WIDTH / 2 - 4,
    height: 42,
    backgroundColor: DS.brandNavy,
    borderRadius: 21,
    left: 3,
    ...Platform.select({
      ios: { shadowColor: DS.brandNavy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  toggleOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    zIndex: 1,
  },
  togglePremiumWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.textSecondary,
  },
  toggleTextActive: {
    color: DS.textInverse,
  },
  toggleBadge: {
    backgroundColor: DS.accentGold,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toggleBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: DS.textInverse,
    letterSpacing: 0.5,
  },

  // Plan Card
  planCard: {
    backgroundColor: DS.bgSurface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 24 },
      android: { elevation: 4 },
    }),
  },
  planBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 16,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: DS.textInverse,
    letterSpacing: 0.8,
  },

  // Price
  priceSection: {
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 16,
    fontWeight: '500',
    color: DS.textSecondary,
    marginLeft: 4,
  },
  planTagline: {
    fontSize: 14,
    fontWeight: '400',
    color: DS.textSecondary,
    marginTop: 4,
  },

  // Credits highlight
  creditsHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 12,
    marginBottom: 20,
  },
  creditsTextWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  creditsNumber: {
    fontSize: 28,
    fontWeight: '800',
  },
  creditsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: DS.textSecondary,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: DS.border,
    marginBottom: 20,
  },

  // Features
  featuresTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  featureIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: DS.textPrimary,
  },
  featureTextDisabled: {
    color: '#C8C2B8',
  },

  // Subscribe button
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    marginTop: 24,
    ...Platform.select({
      ios: { shadowColor: DS.brandNavy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  subscribeBtnDisabled: {
    opacity: 0.7,
  },
  subscribeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: DS.textInverse,
  },

  // Cancel note
  cancelNote: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '400',
    color: DS.textSecondary,
    marginTop: 12,
  },

  // Top-up link
  topupLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: DS.border,
  },
  topupLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: DS.brandNavy,
  },

  // Restore
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  restoreText: {
    fontSize: 13,
    fontWeight: '500',
    color: DS.textSecondary,
    textDecorationLine: 'underline',
  },
});