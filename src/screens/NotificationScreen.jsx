import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, SafeAreaView, Switch,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";

const DS = {
  bgPage: "#FAF8F4", bgSurface: "#FFFEFB", bgSurface2: "#F5F2EC",
  brandNavy: "#1A3A6B", accentGold: "#E8A020", accentGoldSub: "#FEF3DC",
  textPrimary: "#1C1610", textSecondary: "#8A7E72", textInverse: "#FFFEFB",
  border: "#EDE8E0", shadow: "rgba(26,58,107,0.10)",
};

function NotifRow({ icon, iconColor, label, sublabel, value, onToggle, isLast }) {
  return (
    <View style={[rowStyles.container, !isLast && { borderBottomWidth: 1, borderBottomColor: DS.border }]}>
      <View style={[rowStyles.iconBox, { backgroundColor: (iconColor || DS.accentGold) + "18" }]}>
        <Ionicons name={icon} size={18} color={iconColor || DS.accentGold} />
      </View>
      <View style={rowStyles.textBlock}>
        <Text style={rowStyles.label}>{label}</Text>
        {sublabel && <Text style={rowStyles.sublabel}>{sublabel}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: DS.border, true: DS.accentGold + "60" }}
        thumbColor={value ? DS.accentGold : "#FFFFFF"}
        ios_backgroundColor={DS.border}
      />
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 4 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  textBlock: { flex: 1, marginLeft: 14 },
  label: { fontSize: 15, fontWeight: "600", color: DS.textPrimary },
  sublabel: { fontSize: 12, fontWeight: "400", marginTop: 2, color: DS.textSecondary },
});

export default function NotificationsScreen({ navigation }) {
  const [receiptProcessed, setReceiptProcessed] = useState(true);
  const [duplicateWarning, setDuplicateWarning] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(false);
  const [budgetAlerts, setBudgetAlerts] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false} bounces={true}>

        {/* Receipt Alerts */}
        <Text style={styles.sectionLabel}>RECEIPT ALERTS</Text>
        <View style={styles.card}>
          <NotifRow
            icon="checkmark-circle-outline" iconColor="#2A8C5C"
            label="Receipt Processed"
            sublabel="Get notified when a receipt is done processing"
            value={receiptProcessed} onToggle={setReceiptProcessed}
          />
          <NotifRow
            icon="copy-outline" iconColor="#C8402A"
            label="Duplicate Warning"
            sublabel="Alert when a possible duplicate is detected"
            value={duplicateWarning} onToggle={setDuplicateWarning}
            isLast
          />
        </View>

        {/* Insights */}
        <Text style={styles.sectionLabel}>INSIGHTS</Text>
        <View style={styles.card}>
          <NotifRow
            icon="bar-chart-outline" iconColor="#2563C8"
            label="Weekly Summary"
            sublabel="Get a spending summary every Sunday"
            value={weeklySummary} onToggle={setWeeklySummary}
          />
          <NotifRow
            icon="wallet-outline" iconColor="#E8A020"
            label="Budget Alerts"
            sublabel="Notify when spending exceeds your set limits"
            value={budgetAlerts} onToggle={setBudgetAlerts}
            isLast
          />
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={DS.textSecondary} />
          <Text style={styles.infoText}>
            Push notifications require system permissions. Make sure notifications are enabled for BillBrain in your device settings.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 8 : 8, paddingBottom: 12,
  },
  topBarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: DS.bgSurface2, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 17, fontWeight: "600", color: DS.textPrimary },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginLeft: 4, marginTop: 8, color: DS.textSecondary },
  card: {
    backgroundColor: DS.bgSurface, borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: DS.border, marginBottom: 24,
    ...Platform.select({ ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 }, android: { elevation: 2 } }),
  },
  infoBox: {
    flexDirection: "row", backgroundColor: DS.bgSurface2, borderRadius: 12, padding: 14, gap: 10,
  },
  infoText: { flex: 1, fontSize: 13, fontWeight: "400", color: DS.textSecondary, lineHeight: 18 },
});