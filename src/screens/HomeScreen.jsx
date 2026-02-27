/* eslint-disable react-native/no-inline-styles */
import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../config/supabase";
import { launchImageLibrary } from "react-native-image-picker";
import { useProcessing } from "../context/ProcessingContext";
import { useNotifications } from "../context/NotificationContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Design System Tokens ────────────────────────────────────
const DS = {
  bgPage: "#FAF8F4", bgSurface: "#FFFEFB", bgSurface2: "#F5F2EC",
  brandNavy: "#1A3A6B", brandBlue: "#2563C8", accentGold: "#E8A020",
  accentGoldSub: "#FEF3DC", textPrimary: "#1C1610", textSecondary: "#8A7E72",
  textInverse: "#FFFEFB", positive: "#2A8C5C", negative: "#C8402A",
  border: "#EDE8E0", shadow: "rgba(26,58,107,0.10)",
  pagePad: 20, cardPad: 20, cardRadius: 20, buttonHeight: 52,
  iconBox: 40, iconRadius: 12, avatar: 42, navFab: 56, fabPlus: 52, navHeight: 80,
};

const CARD_WIDTH = SCREEN_WIDTH * 0.78;
const CARD_HEIGHT = 230;
const CARD_GAP = 14;
const RECENT_RECEIPT_LIMIT = 4;

// ─── Category Helpers ────────────────────────────────────────
const getCategoryIcon = (cat) => {
  switch ((cat || "").toLowerCase()) {
    case "food": return "restaurant-outline";
    case "bills": return "document-text-outline";
    case "gas": return "car-outline";
    case "shopping": return "bag-outline";
    case "medical": return "medical-outline";
    default: return "receipt-outline";
  }
};

const getCategoryColor = (cat) => {
  switch ((cat || "").toLowerCase()) {
    case "food": return "#E8A020";
    case "bills": return "#2563C8";
    case "gas": return "#C8402A";
    case "shopping": return "#7C3AED";
    case "medical": return "#2A8C5C";
    default: return "#8A7E72";
  }
};

// ─── Data Helpers ────────────────────────────────────────────

function getDateRangeStart(period) {
  const now = new Date();
  switch (period) {
    case "Weekly": return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    case "Monthly": return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case "Yearly": return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    default: return new Date(0);
  }
}

function getPreviousRangeStart(period) {
  const now = new Date();
  switch (period) {
    case "Weekly": return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
    case "Monthly": return new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
    case "Yearly": return new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    default: return new Date(0);
  }
}

function computeSpendingData(receipts, period) {
  const rangeStart = getDateRangeStart(period);
  const prevRangeStart = getPreviousRangeStart(period);
  const current = receipts.filter((r) => { const d = new Date(r.date || r.created_at); return !isNaN(d.getTime()) && d >= rangeStart; });
  const previous = receipts.filter((r) => { const d = new Date(r.date || r.created_at); return !isNaN(d.getTime()) && d >= prevRangeStart && d < rangeStart; });
  const currentTotal = current.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0);
  const previousTotal = previous.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0);
  let changePercent = "0.0"; let changeDirection = "up";
  if (previousTotal > 0) { const c = ((currentTotal - previousTotal) / previousTotal) * 100; changePercent = Math.abs(c).toFixed(1); changeDirection = c >= 0 ? "up" : "down"; }
  else if (currentTotal > 0) { changePercent = "100.0"; changeDirection = "up"; }
  const catTotals = {};
  current.forEach((r) => { const cat = r.category || "Other"; catTotals[cat] = (catTotals[cat] || 0) + (parseFloat(r.total_amount) || 0); });
  let topCategory = null; let topCatAmount = 0;
  Object.entries(catTotals).forEach(([name, amount]) => { if (amount > topCatAmount) { topCategory = { name, amount: `$${amount.toFixed(2)}` }; topCatAmount = amount; } });
  return { total: `$${currentTotal.toFixed(2)}`, changePercent, changeDirection, receiptCount: current.length, topCategory };
}

function computeTopMerchants(receipts) {
  const st = {};
  receipts.forEach((r) => { const n = r.store_name || "Unknown"; st[n] = (st[n] || 0) + (parseFloat(r.total_amount) || 0); });
  const sorted = Object.entries(st).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5);
  const max = sorted.length > 0 ? sorted[0].total : 1;
  return sorted.map((m, i) => ({ id: String(i + 1), name: m.name, total: `$${m.total.toFixed(2)}`, progress: m.total / max }));
}

function formatReceiptTime(receipt) {
  const d = new Date(receipt.date || receipt.created_at);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ─── Header (with live bell badge) ───────────────────────────

function HeaderRow({ userName = "User", navigation }) {
  const bellAnim = useRef(new Animated.Value(0)).current;
  const { unreadCount } = useNotifications();

  const ringBell = () => {
    Animated.sequence([
      Animated.timing(bellAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: 0.6, duration: 70, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: -0.6, duration: 70, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const bellRotate = bellAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-18deg", "0deg", "18deg"] });
  const initial = userName.charAt(0).toUpperCase();

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.bellContainer}
        activeOpacity={0.7}
        onPress={() => {
          ringBell();
          navigation.navigate("Notifications");
        }}
      >
        <Animated.View style={{ transform: [{ rotate: bellRotate }] }}>
          <Icon name="bell" size={20} color={DS.textPrimary} />
        </Animated.View>
        {unreadCount > 0 && (
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Spending Card ───────────────────────────────────────────

function SpendingCard({ receipts, period, onPeriodChange }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const periods = ["Weekly", "Monthly", "Yearly"];
  const data = useMemo(() => computeSpendingData(receipts, period), [receipts, period]);
  const isUp = data.changeDirection === "up";

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, speed: 50, bounciness: 4 }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start()}
        style={styles.cardInner}
      >
        <View style={styles.periodToggle}>
          {periods.map((p) => (
            <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodBtnActive]} onPress={() => onPeriodChange(p)} activeOpacity={0.7}>
              <Text style={[styles.periodTxt, period === p && styles.periodTxtActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.spendLabel}>Total Spending</Text>
        <Text style={styles.spendAmount}>{data.total}</Text>
        <View style={styles.cardMetaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="document-text-outline" size={14} color={DS.brandNavy} />
            <Text style={styles.metaText}>{data.receiptCount} receipt{data.receiptCount !== 1 ? "s" : ""}</Text>
          </View>
          {data.receiptCount > 0 && (
            <View style={[styles.changePill, { backgroundColor: isUp ? "#EBF5EF" : "#FDF2EF" }]}>
              <Icon name={isUp ? "trending-up" : "trending-down"} size={12} color={isUp ? DS.positive : DS.negative} />
              <Text style={[styles.changeTxt, { color: isUp ? DS.positive : DS.negative }]}>{data.changePercent}%</Text>
            </View>
          )}
        </View>
        {data.topCategory && (
          <View style={styles.topCatRow}>
            <Text style={styles.topCatLabel}>Top category</Text>
            <Text style={styles.topCatValue}>{data.topCategory.name}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Merchants Card ──────────────────────────────────────────

function MerchantsCard({ merchants }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity activeOpacity={1}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, speed: 50, bounciness: 4 }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start()}
        style={styles.cardInner}>
        <Text style={styles.merchantsTitle}>Top Stores</Text>
        {merchants.length > 0 ? merchants.map((m, i) => (
          <View key={m.id} style={styles.merchantRow}>
            <View style={styles.merchantLeft}>
              <Text style={styles.merchantRank}>{i + 1}</Text>
              <Text style={styles.merchantName} numberOfLines={1}>{m.name}</Text>
            </View>
            <View style={styles.merchantRight}>
              <Text style={styles.merchantTotal}>{m.total}</Text>
              <View style={styles.merchantBarBg}><View style={[styles.merchantBarFill, { width: `${m.progress * 100}%` }]} /></View>
            </View>
          </View>
        )) : (
          <View style={styles.emptyMerchants}>
            <Ionicons name="storefront-outline" size={28} color={DS.textSecondary} />
            <Text style={styles.emptyMerchantsText}>No store data yet</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Live Pending Bar ────────────────────────────────────────

function LivePendingBar({ dbPendingCount = 0, navigation }) {
  const { jobs } = useProcessing();
  const activeJobs = jobs.filter((j) => j.status === 'uploading' || j.status === 'processing').length;
  const readyJobs = jobs.filter((j) => j.status === 'ready').length;
  const failedJobs = jobs.filter((j) => j.status === 'failed').length;
  const totalPending = activeJobs + readyJobs + failedJobs + dbPendingCount;

  if (totalPending === 0) {
    return (
      <View style={[styles.pendingBar, styles.pendingOk]}>
        <Ionicons name="checkmark-circle" size={18} color={DS.positive} />
        <Text style={[styles.pendingTxt, { color: DS.positive }]}>All receipts processed</Text>
      </View>
    );
  }

  // Show most urgent status
  if (readyJobs > 0) {
    return (
      <TouchableOpacity
        style={[styles.pendingBar, { backgroundColor: DS.accentGoldSub }]}
        onPress={() => navigation.navigate('Main', { screen: 'Receipts', params: { tab: 'review' } })}
        activeOpacity={0.7}
      >
        <Ionicons name="eye-outline" size={18} color={DS.accentGold} />
        <Text style={[styles.pendingTxt, { color: '#B8860B', flex: 1 }]}>
          {readyJobs} receipt{readyJobs > 1 ? 's' : ''} ready to review
        </Text>
        <Icon name="chevron-right" size={16} color="#B8860B" />
      </TouchableOpacity>
    );
  }

  if (activeJobs > 0) {
    return (
      <View style={[styles.pendingBar, { backgroundColor: DS.accentGoldSub }]}>
        <Ionicons name="time-outline" size={18} color={DS.accentGold} />
        <Text style={[styles.pendingTxt, { color: '#B8860B' }]}>
          {activeJobs} receipt{activeJobs > 1 ? 's' : ''} processing…
        </Text>
      </View>
    );
  }

  if (failedJobs > 0) {
    return (
      <TouchableOpacity
        style={[styles.pendingBar, { backgroundColor: '#FDF2EF' }]}
        onPress={() => navigation.navigate('Main', { screen: 'Receipts', params: { tab: 'review' } })}
        activeOpacity={0.7}
      >
        <Ionicons name="alert-circle-outline" size={18} color={DS.negative} />
        <Text style={[styles.pendingTxt, { color: DS.negative, flex: 1 }]}>
          {failedJobs} receipt{failedJobs > 1 ? 's' : ''} failed
        </Text>
        <Icon name="chevron-right" size={16} color={DS.negative} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.pendingBar, { backgroundColor: DS.accentGoldSub }]}>
      <Ionicons name="time-outline" size={18} color={DS.accentGold} />
      <Text style={[styles.pendingTxt, { color: '#B8860B' }]}>
        {totalPending} receipt{totalPending > 1 ? 's' : ''} pending
      </Text>
    </View>
  );
}

// ─── Action Buttons ──────────────────────────────────────────

function ActionButtons({ navigation }) {
  const uploadScale = useRef(new Animated.Value(1)).current;
  const manualScale = useRef(new Animated.Value(1)).current;
  const uploadOpacity = useRef(new Animated.Value(1)).current;
  const manualOpacity = useRef(new Animated.Value(1)).current;
  const pressIn = (s, o) => { Animated.parallel([Animated.spring(s, { toValue: 0.94, useNativeDriver: true, speed: 50 }), Animated.timing(o, { toValue: 0.75, duration: 80, useNativeDriver: true })]).start(); };
  const pressOut = (s, o) => { Animated.parallel([Animated.spring(s, { toValue: 1, useNativeDriver: true, speed: 35, bounciness: 8 }), Animated.timing(o, { toValue: 1, duration: 150, useNativeDriver: true })]).start(); };

  const handleUpload = () => {
    launchImageLibrary({ mediaType: "photo", quality: 1, selectionLimit: 1 }, (response) => {
      if (response.didCancel || response.errorCode) return;
      const asset = response.assets?.[0];
      if (asset?.uri) {
        const path = asset.uri.startsWith("file://") ? asset.uri.replace("file://", "") : asset.uri;
        navigation.navigate("Preview", { photoPath: path });
      }
    });
  };

  return (
    <View style={styles.actionRow}>
      <TouchableOpacity activeOpacity={1} onPressIn={() => pressIn(uploadScale, uploadOpacity)} onPressOut={() => pressOut(uploadScale, uploadOpacity)} onPress={handleUpload} style={{ flex: 1 }}>
        <Animated.View style={[styles.actionBtn, { transform: [{ scale: uploadScale }], opacity: uploadOpacity }]}>
          <Ionicons name="cloud-upload-outline" size={18} color={DS.brandNavy} />
          <Text style={styles.actionBtnText}>Upload</Text>
        </Animated.View>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={1} onPressIn={() => pressIn(manualScale, manualOpacity)} onPressOut={() => pressOut(manualScale, manualOpacity)} onPress={() => navigation?.navigate("ManualEntry")} style={{ flex: 1 }}>
        <Animated.View style={[styles.actionBtn, { transform: [{ scale: manualScale }], opacity: manualOpacity }]}>
          <Icon name="edit-3" size={16} color={DS.brandNavy} />
          <Text style={styles.actionBtnText}>Manual</Text>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Receipt Item ────────────────────────────────────────────

function ReceiptItem({ item, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const catColor = getCategoryColor(item.category);
  return (
    <TouchableOpacity activeOpacity={1}
      onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start()}
      onPress={onPress}>
      <Animated.View style={[styles.txRow, { transform: [{ scale }] }]}>
        <View style={styles.txLeft}>
          <View style={[styles.txIconBox, { backgroundColor: catColor + "18" }]}>
            <Ionicons name={getCategoryIcon(item.category)} size={18} color={catColor} />
          </View>
          <View style={styles.txTextBlock}>
            <Text style={styles.txName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.txTime}>{item.time}</Text>
          </View>
        </View>
        <View style={styles.txRight}>
          <Text style={styles.txAmount}>{item.amount}</Text>
          <Icon name="chevron-right" size={14} color={DS.textSecondary} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Dot Indicator ───────────────────────────────────────────

function DotIndicator({ count, activeIndex }) {
  return (
    <View style={styles.dotRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]} />
      ))}
    </View>
  );
}

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
    <View style={styles.bottomNav}>
      {tabs.map((tab) => {
        if (tab.key === "Scan") {
          return (
            <TouchableOpacity key={tab.key} style={styles.scanOuter} activeOpacity={1}
              onPressIn={() => Animated.spring(scanScale, { toValue: 0.85, useNativeDriver: true, speed: 50 }).start()}
              onPressOut={() => Animated.spring(scanScale, { toValue: 1, useNativeDriver: true, speed: 25, bounciness: 12 }).start()}
              onPress={() => onTabPress(tab.key)}>
              <Animated.View style={[styles.scanBtn, { transform: [{ scale: scanScale }] }]}>
                <Ionicons name="scan-outline" size={24} color={DS.accentGold} />
              </Animated.View>
            </TouchableOpacity>
          );
        }
        const active = activeTab === tab.key;
        const IconComp = tab.lib === "ionicons" ? Ionicons : Icon;
        return (
          <TouchableOpacity key={tab.key} style={styles.navTab} onPress={() => onTabPress(tab.key)} activeOpacity={0.6}>
            <IconComp name={tab.icon} size={20} color={active ? DS.brandNavy : DS.textSecondary} />
            <Text style={[styles.navLabel, { color: active ? DS.brandNavy : DS.textSecondary }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("Home");
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [period, setPeriod] = useState("Monthly");
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [profile, setProfile] = useState(null);

  const fetchReceipts = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setReceipts([]); return; }
      const { data: profileData } = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).single();
      if (profileData) setProfile(profileData);
      const { data, error } = await supabase.from("receipts").select("*").eq("user_id", user.id).order("date", { ascending: false, nullsFirst: false });
      if (error) { console.error("Error fetching receipts:", error); return; }
      setReceipts(data || []);
      const pending = (data || []).filter((r) => r.status && r.status.toLowerCase() === "pending").length;
      setPendingCount(pending);
    } catch (err) { console.error("Fetch error:", err); } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchReceipts(); }, [fetchReceipts]));
  const onRefresh = useCallback(() => fetchReceipts(true), [fetchReceipts]);

  const topMerchants = useMemo(() => computeTopMerchants(receipts), [receipts]);
  const recentReceipts = useMemo(() => receipts.slice(0, RECENT_RECEIPT_LIMIT).map((r) => ({
    id: r.id, name: r.store_name || "Unknown Store", time: formatReceiptTime(r),
    amount: `$${parseFloat(r.total_amount || 0).toFixed(2)}`, category: r.category || "Other", receipt: r,
  })), [receipts]);

  const onCardScroll = (e) => setActiveCardIndex(Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_GAP)));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ScrollView style={styles.mainScroll} contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false} bounces={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.brandNavy} colors={[DS.brandNavy]} />}>

        <HeaderRow userName={profile?.first_name || "User"} navigation={navigation} />
        <Text style={styles.pageTitle}>Overview</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={DS.brandNavy} />
            <Text style={styles.loadingText}>Loading your data...</Text>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}
              decelerationRate="fast" snapToInterval={CARD_WIDTH + CARD_GAP} snapToAlignment="start" onMomentumScrollEnd={onCardScroll}>
              <SpendingCard receipts={receipts} period={period} onPeriodChange={setPeriod} />
              <MerchantsCard merchants={topMerchants} />
            </ScrollView>

            <DotIndicator count={2} activeIndex={activeCardIndex} />
            <LivePendingBar dbPendingCount={pendingCount} navigation={navigation} />
            <ActionButtons navigation={navigation} />

            <View style={styles.receiptsSection}>
              <View style={styles.receiptsHeader}>
                <Text style={styles.receiptsTitle}>Recent Receipts</Text>
                {receipts.length > RECENT_RECEIPT_LIMIT && (
                  <TouchableOpacity activeOpacity={0.6} onPress={() => navigation.navigate("Receipts")}>
                    <Text style={styles.receiptsViewAll}>View all</Text>
                  </TouchableOpacity>
                )}
              </View>
              {recentReceipts.length > 0 ? recentReceipts.map((r) => (
                <ReceiptItem key={r.id} item={r} onPress={() => navigation.navigate("Detail", { receipt: r.receipt })} />
              )) : (
                <View style={styles.emptyReceipts}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="receipt-outline" size={28} color={DS.textSecondary} />
                  </View>
                  <Text style={styles.emptyTitle}>No receipts yet</Text>
                  <Text style={styles.emptySubtitle}>Scan or add your first receipt to get started</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <BottomNav
        activeTab={activeTab}
        onTabPress={(tab) => {
          setActiveTab(tab);
          if (tab !== "Home") {
            navigation.navigate(tab);
          }
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },
  mainScroll: { flex: 1 },
  mainScrollContent: { paddingHorizontal: DS.pagePad, paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 10 : 12, paddingBottom: DS.navHeight + 24 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  avatar: { width: DS.avatar, height: DS.avatar, borderRadius: DS.avatar / 2, backgroundColor: DS.brandNavy, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: DS.textInverse },
  headerTextBlock: { marginLeft: 10 },
  welcomeText: { fontSize: 12, fontWeight: "400", color: DS.textSecondary },
  userName: { fontSize: 16, fontWeight: "600", color: DS.textPrimary, marginTop: 1 },
  bellContainer: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: DS.bgSurface,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({ ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  bellBadge: {
    position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: DS.negative, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4, borderWidth: 2, borderColor: DS.bgPage,
  },
  bellBadgeText: { fontSize: 10, fontWeight: "800", color: DS.textInverse },

  pageTitle: { fontSize: 26, fontWeight: "700", color: DS.textPrimary, letterSpacing: -0.3, marginTop: 16, marginBottom: 12 },

  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  loadingText: { fontSize: 14, color: DS.textSecondary, marginTop: 12 },

  carousel: { paddingRight: DS.pagePad },
  card: {
    width: CARD_WIDTH, height: CARD_HEIGHT, overflow: "hidden", backgroundColor: DS.bgSurface, borderRadius: DS.cardRadius,
    marginRight: CARD_GAP, borderWidth: 1, borderColor: DS.border,
    ...Platform.select({ ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 }, android: { elevation: 0 } }),
  },
  cardInner: { paddingHorizontal: DS.cardPad, paddingTop: 16, paddingBottom: 14, flex: 1, justifyContent: "space-between" },

  periodToggle: { flexDirection: "row", backgroundColor: DS.bgSurface2, borderRadius: 999, padding: 3, alignSelf: "flex-start" },
  periodBtn: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999 },
  periodBtnActive: { backgroundColor: DS.brandNavy },
  periodTxt: { fontSize: 12, fontWeight: "600", color: DS.textSecondary },
  periodTxtActive: { color: DS.textInverse },
  spendLabel: { fontSize: 12, fontWeight: "400", color: DS.textSecondary, marginTop: 12 },
  spendAmount: { fontSize: 34, fontWeight: "700", color: DS.textPrimary, letterSpacing: -0.5, marginTop: 2 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, fontWeight: "500", color: DS.textSecondary },
  changePill: { flexDirection: "row", alignItems: "center", borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8, gap: 4 },
  changeTxt: { fontSize: 11, fontWeight: "600" },
  topCatRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: DS.border, paddingTop: 8, marginTop: 8 },
  topCatLabel: { fontSize: 11, fontWeight: "500", color: DS.textSecondary },
  topCatValue: { fontSize: 13, fontWeight: "600", color: DS.textPrimary },

  merchantsTitle: { fontSize: 18, fontWeight: "700", color: DS.textPrimary, marginBottom: 10 },
  merchantRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 5 },
  merchantLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  merchantRank: { fontSize: 13, fontWeight: "700", color: DS.textSecondary, width: 20 },
  merchantName: { fontSize: 15, fontWeight: "600", color: DS.textPrimary, flex: 1 },
  merchantRight: { alignItems: "flex-end", width: 85 },
  merchantTotal: { fontSize: 14, fontWeight: "700", color: DS.textPrimary, marginBottom: 3 },
  merchantBarBg: { width: "100%", height: 3, backgroundColor: DS.bgSurface2, borderRadius: 2 },
  merchantBarFill: { height: 3, backgroundColor: DS.brandNavy, borderRadius: 2 },
  emptyMerchants: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyMerchantsText: { fontSize: 14, color: DS.textSecondary },

  dotRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 10, gap: 5 },
  dot: { borderRadius: 999 },
  dotActive: { width: 18, height: 6, backgroundColor: DS.brandNavy, borderRadius: 3 },
  dotInactive: { width: 6, height: 6, backgroundColor: DS.border },

  pendingBar: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, marginTop: 12, gap: 8 },
  pendingOk: { backgroundColor: "#EBF5EF" },
  pendingTxt: { fontSize: 13, fontWeight: "600" },

  actionRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 12 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", height: 48, borderRadius: 999,
    backgroundColor: DS.bgSurface, gap: 8, borderWidth: 1.5, borderColor: DS.brandNavy,
    ...Platform.select({ ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 12 }, android: { elevation: 2 } }),
  },
  actionBtnText: { fontSize: 14, fontWeight: "600", color: DS.brandNavy },

  receiptsSection: { marginTop: 20 },
  receiptsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  receiptsTitle: { fontSize: 26, fontWeight: "700", color: DS.textPrimary, letterSpacing: -0.3 },
  receiptsViewAll: { fontSize: 13, fontWeight: "500", color: DS.brandBlue },

  txRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  txLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  txIconBox: { width: DS.iconBox, height: DS.iconBox, borderRadius: DS.iconRadius, alignItems: "center", justifyContent: "center" },
  txTextBlock: { marginLeft: 12, flex: 1 },
  txName: { fontSize: 15, fontWeight: "600", color: DS.textPrimary },
  txTime: { fontSize: 12, fontWeight: "400", color: DS.textSecondary, marginTop: 3 },
  txRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  txAmount: { fontSize: 15, fontWeight: "600", color: DS.textPrimary },

  emptyReceipts: { alignItems: "center", paddingVertical: 32 },
  emptyIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: DS.bgSurface2, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: DS.textPrimary, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: DS.textSecondary, textAlign: "center" },

  // Bottom nav
  bottomNav: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-around",
    height: DS.navHeight, backgroundColor: DS.bgSurface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 6 : 0, zIndex: 20,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 8 },
    }),
  },
  navTab: { alignItems: "center", justifyContent: "center", paddingVertical: 6, minWidth: 48 },
  navLabel: { fontSize: 11, fontWeight: "400", marginTop: 3 },
  scanOuter: { marginTop: -26 },
  scanBtn: {
    width: DS.navFab, height: DS.navFab, borderRadius: DS.navFab / 2,
    backgroundColor: DS.brandNavy, alignItems: "center", justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
});