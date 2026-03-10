import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, SafeAreaView, Animated, Modal,
  ActivityIndicator, Image, Linking,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../config/supabase";
import { useCredits } from "../context/CreditsContext";

const SIZING = {
  pagePad: 20, cardPad: 20, cardRadius: 20,
  iconBox: 40, iconRadius: 12, avatar: 72, navFab: 56, navHeight: 80,
};

const DS = {
  bgPage: "#FAF8F4", bgSurface: "#FFFEFB", bgSurface2: "#F5F2EC",
  brandNavy: "#1A3A6B", brandBlue: "#2563C8", accentGold: "#E8A020",
  accentGoldSub: "#FEF3DC", textPrimary: "#1C1610", textSecondary: "#8A7E72",
  textMuted: "#B8B0A4", textInverse: "#FFFEFB", positive: "#2A8C5C",
  negative: "#C8402A", border: "#EDE8E0", shadow: "rgba(26,58,107,0.10)",
};

// ─── Settings Row ────────────────────────────────────────────

function SettingsRow({ icon, iconLib, iconColor, label, sublabel, onPress, rightElement, isLast }) {
  const scale = useRef(new Animated.Value(1)).current;
  const IconComp = iconLib === "ionicons" ? Ionicons : Icon;
  const content = (
    <Animated.View style={[rowStyles.container, !isLast && { borderBottomWidth: 1, borderBottomColor: DS.border }, { transform: [{ scale }] }]}>
      <View style={[rowStyles.iconBox, { backgroundColor: (iconColor || DS.accentGold) + "18" }]}>
        <IconComp name={icon} size={18} color={iconColor || DS.accentGold} />
      </View>
      <View style={rowStyles.textBlock}>
        <Text style={rowStyles.label}>{label}</Text>
        {sublabel && <Text style={rowStyles.sublabel}>{sublabel}</Text>}
      </View>
      {rightElement || <Icon name="chevron-right" size={18} color={DS.textSecondary} />}
    </Animated.View>
  );
  if (!onPress) return content;
  return (
    <TouchableOpacity activeOpacity={1}
      onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start()}
      onPress={onPress}>{content}</TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 4 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  textBlock: { flex: 1, marginLeft: 14 },
  label: { fontSize: 15, fontWeight: "600", color: DS.textPrimary },
  sublabel: { fontSize: 12, fontWeight: "400", marginTop: 2, color: DS.textSecondary },
});

// ─── Bottom Nav ──────────────────────────────────────────────

function BottomNav({ activeTab, onTabPress }) {
  const scanScale = useRef(new Animated.Value(1)).current;
  const tabs = [
    { key: "Home", icon: "home", label: "Home", lib: "feather" },
    { key: "Receipts", icon: "file-text", label: "Receipts", lib: "feather" },
    { key: "Scan", icon: "scan-outline", label: "", lib: "ionicons" },
    { key: "AIChat", icon: "chatbubble-ellipses-outline", label: "AI Chat", lib: "ionicons" },
    { key: "Settings", icon: "sliders", label: "Settings", lib: "feather" },
  ];
  return (
    <View style={navStyles.bottomNav}>
      {tabs.map((tab) => {
        if (tab.key === "Scan") {
          return (
            <TouchableOpacity key={tab.key} style={navStyles.scanOuter} activeOpacity={1}
              onPressIn={() => Animated.spring(scanScale, { toValue: 0.85, useNativeDriver: true, speed: 50 }).start()}
              onPressOut={() => Animated.spring(scanScale, { toValue: 1, useNativeDriver: true, speed: 25, bounciness: 12 }).start()}
              onPress={() => onTabPress(tab.key)}>
              <Animated.View style={[navStyles.scanBtn, { transform: [{ scale: scanScale }] }]}>
                <Ionicons name="scan-outline" size={24} color={DS.accentGold} />
              </Animated.View>
            </TouchableOpacity>
          );
        }
        const active = activeTab === tab.key;
        const IconComp = tab.lib === "ionicons" ? Ionicons : Icon;
        return (
          <TouchableOpacity key={tab.key} style={navStyles.navTab} onPress={() => onTabPress(tab.key)} activeOpacity={0.6}>
            <IconComp name={tab.icon} size={20} color={active ? DS.brandNavy : DS.textSecondary} />
            <Text style={[navStyles.navLabel, { color: active ? DS.brandNavy : DS.textSecondary }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const navStyles = StyleSheet.create({
  bottomNav: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-around",
    height: 80, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 6 : 0, zIndex: 20,
    backgroundColor: DS.bgSurface,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 8 },
    }),
  },
  navTab: { alignItems: "center", justifyContent: "center", paddingVertical: 6, minWidth: 48 },
  navLabel: { fontSize: 11, fontWeight: "400", marginTop: 3 },
  scanOuter: { marginTop: -26 },
  scanBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: DS.brandNavy,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
});

// ─── Main Settings Screen ────────────────────────────────────

export default function SettingsScreen({ navigation }) {
  const [activeTab] = useState("Settings");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);

  const { credits, tierName, isSubscribed, activeRemaining, fetchCredits } = useCredits();

  useFocusEffect(
    useCallback(() => {
      fetchCredits();
      (async () => {
        try {
          setLoading(true);
          const { data: { user: authUser } } = await supabase.auth.getUser();
          setUser(authUser);
          if (authUser) {
            const { data: profileData } = await supabase
              .from("profiles").select("*").eq("id", authUser.id).single();
            setProfile(profileData);

            if (profileData?.avatar_url) {
              const { data: signedData } = await supabase.storage
                .from("avtars")
                .createSignedUrl(profileData.avatar_url, 3600);
              if (signedData?.signedUrl) setAvatarUrl(signedData.signedUrl);
              else setAvatarUrl(null);
            } else {
              setAvatarUrl(null);
            }
            // Check Gmail connection status
            const { data: gmailData } = await supabase
              .from("gmail_connections")
              .select("id")
              .eq("user_id", authUser.id)
              .maybeSingle();
            setGmailConnected(!!gmailData);
          }
        } catch (e) {
          console.error("Error fetching user:", e);
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Logout error:", e);
      setLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const firstName = profile?.first_name || user?.user_metadata?.first_name || user?.user_metadata?.full_name?.split(" ")[0] || "";
  const lastName = profile?.last_name || user?.user_metadata?.last_name || user?.user_metadata?.full_name?.split(" ").slice(1).join(" ") || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "User";
  const email = user?.email || "";
  const initial = fullName.charAt(0).toUpperCase();
  const currencyDisplay = profile?.currency || "CAD";
  const countryDisplay = profile?.country || "Canada";

  // ── Credit calculations ──
  const planRemaining = activeRemaining.remaining || 0;
  const planLimit = activeRemaining.limit || 0;
  const topupCredits = credits?.topup_remaining || 0;
  const totalRemaining = planRemaining + topupCredits;
  const totalLimit = planLimit + topupCredits;

  const isPremium = tierName === 'Premium';
  const isEssential = tierName === 'Essential';
  const isFree = !isSubscribed;
  const accentColor = isPremium ? DS.accentGold : isEssential ? DS.brandNavy : DS.textSecondary;

  // Plan bar
  const planBarPercent = planLimit > 0 ? Math.min((planRemaining / planLimit) * 100, 100) : 0;
  const planBarColor = planRemaining === 0 ? DS.negative
    : (planLimit > 0 && planRemaining / planLimit <= 0.2) ? DS.accentGold
    : accentColor;

  // Navigate to paywall with specific tab
  const navigatePaywall = (tab) => {
    navigation.navigate('Paywall', { initialTab: tab });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ScrollView style={styles.mainScroll} contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false} bounces={true}>
        <Text style={styles.pageTitle}>Settings</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={DS.brandNavy} />
          </View>
        ) : (
          <>
            {/* ── Profile + Plan Card ── */}
            <View style={styles.profileCard}>
              {/* Profile row */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate("ProfileEdit", { user, profile })}
                style={styles.profileRow}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.profileAvatarImage} />
                ) : (
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>{initial}</Text>
                  </View>
                )}
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{fullName}</Text>
                  <Text style={styles.profileEmail}>{email}</Text>
                </View>
                <Icon name="chevron-right" size={20} color={DS.textSecondary} />
              </TouchableOpacity>

              <View style={styles.profileDivider} />

              {/* Plan + Credits section */}
              <View style={styles.planSection}>
                {/* Plan badge + total credits */}
                <View style={styles.planTopRow}>
                  <View style={styles.planNameWrap}>
                    <Ionicons
                      name={isFree ? 'flash-outline' : 'diamond'}
                      size={14}
                      color={accentColor}
                    />
                    <Text style={[styles.planName, { color: accentColor }]}>{tierName}</Text>
                    <View style={[styles.planPill, { backgroundColor: isFree ? DS.bgSurface2 : accentColor + '12' }]}>
                      <Text style={[styles.planPillText, { color: isFree ? DS.textMuted : accentColor }]}>
                        {isFree ? 'FREE' : 'ACTIVE'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.totalCredits}>
                    <Text style={styles.totalCreditsNum}>{totalRemaining}</Text>
                    <Text style={styles.totalCreditsLabel}> total</Text>
                  </Text>
                </View>

                {/* ── Dual credit bars ── */}
                <View style={styles.barsContainer}>
                  {/* Plan credits bar */}
                  <View style={styles.barRow}>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barLabel}>{isFree ? 'Free' : tierName}</Text>
                      <Text style={styles.barCount}>
                        <Text style={[styles.barCountNum, { color: planBarColor }]}>{planRemaining}</Text>
                        <Text style={styles.barCountOf}> / {planLimit}</Text>
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${planBarPercent}%`, backgroundColor: planBarColor }]} />
                    </View>
                  </View>

                  {/* Top-up credits bar — only show if user has any */}
                  {topupCredits > 0 && (
                    <View style={styles.barRow}>
                      <View style={styles.barLabelRow}>
                        <View style={styles.topupLabelWrap}>
                          <Ionicons name="add-circle" size={11} color={DS.brandBlue} />
                          <Text style={[styles.barLabel, { color: DS.brandBlue }]}>Top-up</Text>
                        </View>
                        <Text style={styles.barCount}>
                          <Text style={[styles.barCountNum, { color: DS.brandBlue }]}>{topupCredits}</Text>
                          <Text style={styles.barCountOf}> remaining</Text>
                        </Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: '100%', backgroundColor: DS.brandBlue }]} />
                      </View>
                    </View>
                  )}
                </View>

                {/* Action buttons */}
                <View style={styles.planActions}>
                  {isFree ? (
                    <>
                      <TouchableOpacity
                        style={styles.upgradeBtn}
                        onPress={() => navigatePaywall('premium')}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="flash" size={14} color={DS.textInverse} />
                        <Text style={styles.upgradeBtnText}>Upgrade Plan</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.buyCreditsBtn}
                        onPress={() => navigatePaywall('topup')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add-circle-outline" size={14} color={DS.brandNavy} />
                        <Text style={styles.buyCreditsBtnText}>Buy Credits</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.changePlanBtn}
                        onPress={() => navigatePaywall(isPremium ? 'premium' : 'essential')}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="swap-horizontal" size={14} color={DS.textInverse} />
                        <Text style={styles.changePlanBtnText}>View Plans</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.buyCreditsBtn}
                        onPress={() => navigatePaywall('topup')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add-circle-outline" size={14} color={DS.brandNavy} />
                        <Text style={styles.buyCreditsBtnText}>Buy Credits</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* Manage billing — subscribers only */}
                {isSubscribed && (
                  <TouchableOpacity
                    style={styles.manageBillingRow}
                    onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="card-outline" size={14} color={DS.textSecondary} />
                    <Text style={styles.manageBillingText}>Manage Billing & Cancellation</Text>
                    <Ionicons name="open-outline" size={12} color={DS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Preferences */}
            <Text style={styles.sectionLabel}>PREFERENCES</Text>
            <View style={styles.sectionCard}>
              <SettingsRow icon="notifications-outline" iconLib="ionicons" iconColor="#2563C8"
                label="Notifications" sublabel="Manage alerts and reminders"
                onPress={() => navigation.navigate("Notifications")} />
              <SettingsRow icon="globe-outline" iconLib="ionicons" iconColor="#2A8C5C"
                label="Currency & Region" sublabel={`${countryDisplay} · ${currencyDisplay}`}
                onPress={() => navigation.navigate("CurrencyRegion", { profile })} />
              <SettingsRow icon="download-outline" iconLib="ionicons" iconColor="#7C3AED"
                label="Export Documents" sublabel="Download receipts as Excel"
                onPress={() => navigation.navigate("ExportDocuments")} />
              <SettingsRow icon="pricetag-outline" iconLib="ionicons" iconColor="#E8A020"
                label="Categories" sublabel="Manage receipt categories"
                onPress={() => navigation.navigate("Categories")} isLast />
            </View>

            {/* ── Integrations ── */}
            <Text style={styles.sectionLabel}>INTEGRATIONS</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate("GmailReceipts")}
              style={styles.gmailCard}
            >


              <View style={styles.gmailCardInner}>
                {/* Left: icon + text */}
                <View style={styles.gmailCardLeft}>
                  {/* Mail icon */}
                  <View style={styles.gmailIconWrap}>
                    <Ionicons name="mail" size={22} color={DS.accentGold} />
                  </View>
                  <View style={styles.gmailTextBlock}>
                    <View style={styles.gmailLabelRow}>
                      <Text style={styles.gmailLabel}>Connect Gmail</Text>
                      {gmailConnected && (
                        <View style={styles.gmailConnectedBadge}>
                          <View style={styles.gmailConnectedDot} />
                          <Text style={styles.gmailConnectedText}>Connected</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.gmailSublabel}>
                      {gmailConnected
                        ? "Auto-detecting receipts from your inbox"
                        : "Automatically find receipts in your inbox"}
                    </Text>
                  </View>
                </View>

                {/* Right: arrow */}
                <View style={styles.gmailArrowWrap}>
                  <Icon name="chevron-right" size={16} color={DS.brandNavy} />
                </View>
              </View>
            </TouchableOpacity>

            {/* ── Support ── */}
            <Text style={styles.sectionLabel}>SUPPORT</Text>
            <View style={styles.sectionCard}>
              <SettingsRow icon="help-circle" iconLib="feather" iconColor="#E8A020"
                label="Help & Support" sublabel="Get in touch with us"
                onPress={() => navigation.navigate("HelpSupport", { user, profile })} isLast />
            </View>

            {/* Logout */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setShowLogoutModal(true)} style={styles.logoutBtn}>
              <Icon name="log-out" size={18} color={DS.negative} />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>

            <Text style={styles.versionText}>BillBrain v1.0.0</Text>
          </>
        )}
      </ScrollView>

      {/* Logout Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconCircle, { backgroundColor: DS.negative + "14" }]}>
              <Icon name="log-out" size={24} color={DS.negative} />
            </View>
            <Text style={styles.modalTitle}>Log Out?</Text>
            <Text style={styles.modalMessage}>Are you sure you want to log out of your account?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setShowLogoutModal(false)} activeOpacity={0.7}>
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnDanger} onPress={handleLogout} activeOpacity={0.7}>
                {loggingOut ? <ActivityIndicator size="small" color={DS.textInverse} /> :
                  <Text style={styles.modalBtnDangerText}>Log Out</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav activeTab={activeTab} onTabPress={(tab) => { if (tab !== "Settings") navigation.navigate(tab); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },
  mainScroll: { flex: 1 },
  mainScrollContent: { paddingHorizontal: SIZING.pagePad, paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 10 : 12, paddingBottom: SIZING.navHeight + 24 },
  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  pageTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.3, marginBottom: 20, color: DS.textPrimary },

  // Profile + Plan unified card
  profileCard: {
    borderRadius: SIZING.cardRadius, borderWidth: 1, marginBottom: 24,
    backgroundColor: DS.bgSurface, borderColor: DS.border,
    ...Platform.select({ ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 }, android: { elevation: 3 } }),
  },
  profileRow: { flexDirection: "row", alignItems: "center", padding: SIZING.cardPad },
  profileAvatar: { width: SIZING.avatar, height: SIZING.avatar, borderRadius: SIZING.avatar / 2, backgroundColor: DS.brandNavy, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { fontSize: 28, fontWeight: "700", color: DS.textInverse },
  profileAvatarImage: { width: SIZING.avatar, height: SIZING.avatar, borderRadius: SIZING.avatar / 2 },
  profileInfo: { flex: 1, marginLeft: 16 },
  profileName: { fontSize: 18, fontWeight: "700", color: DS.textPrimary },
  profileEmail: { fontSize: 13, fontWeight: "400", marginTop: 3, color: DS.textSecondary },

  profileDivider: { height: 1, backgroundColor: DS.border, marginHorizontal: SIZING.cardPad },

  // Plan section
  planSection: { padding: SIZING.cardPad, paddingTop: 14, paddingBottom: 18 },

  planTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  planNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planName: { fontSize: 15, fontWeight: '700' },
  planPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  planPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  totalCredits: { flexDirection: 'row', alignItems: 'baseline' },
  totalCreditsNum: { fontSize: 18, fontWeight: '800', color: DS.textPrimary },
  totalCreditsLabel: { fontSize: 12, fontWeight: '400', color: DS.textMuted },

  // Dual bars
  barsContainer: { gap: 10, marginBottom: 4 },
  barRow: {},
  barLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  barLabel: { fontSize: 11, fontWeight: '600', color: DS.textSecondary },
  barCount: {},
  barCountNum: { fontSize: 12, fontWeight: '700' },
  barCountOf: { fontSize: 11, fontWeight: '400', color: DS.textMuted },
  topupLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  barTrack: { height: 5, backgroundColor: DS.bgSurface2, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  // Action buttons
  planActions: { flexDirection: 'row', gap: 8, marginTop: 14 },

  upgradeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 40, borderRadius: 20, backgroundColor: DS.accentGold,
    ...Platform.select({
      ios: { shadowColor: DS.accentGold, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  upgradeBtnText: { fontSize: 13, fontWeight: '700', color: DS.textInverse },

  changePlanBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 40, borderRadius: 20, backgroundColor: DS.brandNavy,
    ...Platform.select({
      ios: { shadowColor: DS.brandNavy, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  changePlanBtnText: { fontSize: 13, fontWeight: '700', color: DS.textInverse },

  buyCreditsBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 40, borderRadius: 20,
    backgroundColor: DS.bgSurface, borderWidth: 1.5, borderColor: DS.brandNavy,
  },
  buyCreditsBtnText: { fontSize: 13, fontWeight: '600', color: DS.brandNavy },

  // Manage billing
  manageBillingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: DS.border,
  },
  manageBillingText: { fontSize: 12, fontWeight: '500', color: DS.textSecondary },

  // Sections
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginLeft: 4, color: DS.textSecondary },
  sectionCard: {
    borderRadius: SIZING.cardRadius, paddingHorizontal: 16, borderWidth: 1, marginBottom: 24,
    backgroundColor: DS.bgSurface, borderColor: DS.border,
    ...Platform.select({ ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 }, android: { elevation: 2 } }),
  },
  // Gmail feature highlight card
  gmailCard: {
    borderRadius: SIZING.cardRadius, borderWidth: 1, marginBottom: 24,
    backgroundColor: DS.bgSurface, borderColor: DS.border,
    overflow: 'hidden', minHeight: 80,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 3 },
    }),
  },
  gmailBlob1: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    backgroundColor: DS.accentGoldSub, top: -50, right: -30,
  },
  gmailBlob2: {
    position: 'absolute', width: 70, height: 70, borderRadius: 35,
    backgroundColor: DS.brandNavy + '08', bottom: -25, right: 80,
  },
  gmailCardInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 18, paddingHorizontal: 16, gap: 14,
  },
  gmailCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  gmailIconWrap: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: DS.accentGoldSub, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: DS.accentGold + '30',
  },
  gmailMText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  gmailTextBlock: { flex: 1 },
  gmailLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  gmailLabel: { fontSize: 15, fontWeight: '700', color: DS.textPrimary },
  gmailConnectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: DS.positive + '14', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20,
  },
  gmailConnectedDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: DS.positive },
  gmailConnectedText: { fontSize: 10, fontWeight: '700', color: DS.positive },
  gmailSublabel: { fontSize: 12, fontWeight: '400', color: DS.textSecondary, lineHeight: 16 },
  gmailArrowWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: DS.bgSurface2, alignItems: 'center', justifyContent: 'center',
  },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", height: 52, borderRadius: 999, borderWidth: 1, gap: 8, marginBottom: 16,
    backgroundColor: DS.bgSurface, borderColor: DS.negative + "30",
    ...Platform.select({ ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 }, android: { elevation: 1 } }),
  },
  logoutText: { fontSize: 15, fontWeight: "600", color: DS.negative },
  versionText: { fontSize: 12, fontWeight: "400", textAlign: "center", marginBottom: 8, color: DS.textSecondary },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 32 },
  modalContent: { width: "100%", borderRadius: 24, padding: 28, alignItems: "center", backgroundColor: DS.bgSurface },
  modalIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8, color: DS.textPrimary },
  modalMessage: { fontSize: 14, fontWeight: "400", textAlign: "center", lineHeight: 20, marginBottom: 24, color: DS.textSecondary },
  modalActions: { flexDirection: "row", gap: 12, width: "100%" },
  modalBtnSecondary: { flex: 1, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DS.bgSurface2 },
  modalBtnSecondaryText: { fontSize: 15, fontWeight: "600", color: DS.textPrimary },
  modalBtnDanger: { flex: 1, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DS.negative },
  modalBtnDangerText: { fontSize: 15, fontWeight: "600", color: DS.textInverse },
});