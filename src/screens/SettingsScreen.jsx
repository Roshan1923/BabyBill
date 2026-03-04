import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, SafeAreaView, Animated, Modal,
  ActivityIndicator, Image,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../config/supabase";

const SIZING = {
  pagePad: 20, cardPad: 20, cardRadius: 20,
  iconBox: 40, iconRadius: 12, avatar: 72, navFab: 56, navHeight: 80,
};

const DS = {
  bgPage: "#FAF8F4", bgSurface: "#FFFEFB", bgSurface2: "#F5F2EC",
  brandNavy: "#1A3A6B", brandBlue: "#2563C8", accentGold: "#E8A020",
  accentGoldSub: "#FEF3DC", textPrimary: "#1C1610", textSecondary: "#8A7E72",
  textInverse: "#FFFEFB", positive: "#2A8C5C", negative: "#C8402A",
  border: "#EDE8E0", shadow: "rgba(26,58,107,0.10)",
};

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

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          const { data: { user: authUser } } = await supabase.auth.getUser();
          setUser(authUser);
          if (authUser) {
            const { data: profileData } = await supabase
              .from("profiles").select("*").eq("id", authUser.id).single();
            setProfile(profileData);

            // Load avatar signed URL from private bucket
            if (profileData?.avatar_url) {
              const { data: signedData } = await supabase.storage
                .from("avtars")
                .createSignedUrl(profileData.avatar_url, 3600);
              if (signedData?.signedUrl) setAvatarUrl(signedData.signedUrl);
              else setAvatarUrl(null);
            } else {
              setAvatarUrl(null);
            }
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
            {/* Profile Card */}
            <TouchableOpacity activeOpacity={0.8}
              onPress={() => navigation.navigate("ProfileEdit", { user, profile })}
              style={styles.profileCard}>
              <View style={styles.profileRow}>
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
              </View>
            </TouchableOpacity>

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
                onPress={() => navigation.navigate("ExportDocuments")} isLast />
              <SettingsRow icon="pricetag-outline" iconLib="ionicons" iconColor="#E8A020"
                label="Categories" sublabel="Manage receipt categories"
                onPress={() => navigation.navigate("Categories")} isLast />
            </View>

            {/* Support */}
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
  profileCard: {
    borderRadius: SIZING.cardRadius, padding: SIZING.cardPad, borderWidth: 1, marginBottom: 24,
    backgroundColor: DS.bgSurface, borderColor: DS.border,
    ...Platform.select({ ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 }, android: { elevation: 3 } }),
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  profileAvatar: { width: SIZING.avatar, height: SIZING.avatar, borderRadius: SIZING.avatar / 2, backgroundColor: DS.brandNavy, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { fontSize: 28, fontWeight: "700", color: DS.textInverse },
  profileAvatarImage: { width: SIZING.avatar, height: SIZING.avatar, borderRadius: SIZING.avatar / 2 },
  profileInfo: { flex: 1, marginLeft: 16 },
  profileName: { fontSize: 18, fontWeight: "700", color: DS.textPrimary },
  profileEmail: { fontSize: 13, fontWeight: "400", marginTop: 3, color: DS.textSecondary },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginLeft: 4, color: DS.textSecondary },
  sectionCard: {
    borderRadius: SIZING.cardRadius, paddingHorizontal: 16, borderWidth: 1, marginBottom: 24,
    backgroundColor: DS.bgSurface, borderColor: DS.border,
    ...Platform.select({ ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 }, android: { elevation: 2 } }),
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