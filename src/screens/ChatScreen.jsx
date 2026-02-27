import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, Platform, StatusBar, SafeAreaView, Animated,
  TouchableOpacity,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";

const DS = {
  bgPage: "#FAF8F4", bgSurface: "#FFFEFB", bgSurface2: "#F5F2EC",
  brandNavy: "#1A3A6B", brandBlue: "#2563C8", accentGold: "#E8A020",
  accentGoldSub: "#FEF3DC", textPrimary: "#1C1610", textSecondary: "#8A7E72",
  textInverse: "#FFFEFB", positive: "#2A8C5C", negative: "#C8402A",
  border: "#EDE8E0", shadow: "rgba(26,58,107,0.10)",
};

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

export default function ChatScreen({ navigation }) {
  const [activeTab] = useState("AIChat");
  const pulseAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={styles.content}>
        {/* Icon */}
        <Animated.View style={[styles.iconCircle, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={40} color={DS.brandNavy} />
        </Animated.View>

        {/* Text */}
        <Text style={styles.title}>AI Chat</Text>
        <Text style={styles.subtitle}>
          Ask questions about your spending,{"\n"}search receipts, and get insights.
        </Text>

        {/* Badge */}
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>Coming Soon</Text>
        </View>

        {/* Feature preview pills */}
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Ionicons name="search-outline" size={14} color={DS.brandNavy} />
            <Text style={styles.pillText}>Smart Search</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="analytics-outline" size={14} color={DS.brandNavy} />
            <Text style={styles.pillText}>Spending Insights</Text>
          </View>
        </View>
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Ionicons name="receipt-outline" size={14} color={DS.brandNavy} />
            <Text style={styles.pillText}>Receipt Lookup</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="bulb-outline" size={14} color={DS.brandNavy} />
            <Text style={styles.pillText}>Budget Tips</Text>
          </View>
        </View>
      </View>

      <BottomNav
        activeTab={activeTab}
        onTabPress={(tab) => {
          if (tab !== "AIChat") navigation.navigate(tab);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },
  content: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, paddingBottom: 80,
  },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: DS.brandNavy + "10",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  title: {
    fontSize: 26, fontWeight: "700", color: DS.textPrimary,
    letterSpacing: -0.3, marginBottom: 8,
  },
  subtitle: {
    fontSize: 15, fontWeight: "400", color: DS.textSecondary,
    textAlign: "center", lineHeight: 22, marginBottom: 20,
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: DS.accentGoldSub, paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 999, marginBottom: 28,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: DS.accentGold },
  badgeText: { fontSize: 13, fontWeight: "600", color: "#B8860B" },
  pillRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: DS.bgSurface, borderRadius: 999,
    paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 1 },
    }),
  },
  pillText: { fontSize: 12, fontWeight: "600", color: DS.textPrimary },
});