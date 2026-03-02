import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  StatusBar, SafeAreaView, Animated, Modal, ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";
import { supabase } from "../config/supabase";
import RNFS from "react-native-fs";
import XLSX from "xlsx";
import Share from "react-native-share";

const DS = {
  bgPage: "#FAF8F4", bgSurface: "#FFFEFB", bgSurface2: "#F5F2EC",
  brandNavy: "#1A3A6B", brandBlue: "#2563C8", accentGold: "#E8A020",
  accentGoldSub: "#FEF3DC", textPrimary: "#1C1610", textSecondary: "#8A7E72",
  textInverse: "#FFFEFB", positive: "#2A8C5C", negative: "#C8402A",
  border: "#EDE8E0", shadow: "rgba(26,58,107,0.10)",
};

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ─── Calendar Component ──────────────────────────────────────

function Calendar({ startDate, endDate, onSelect, selecting }) {
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => {
    const next = new Date(year, month + 1, 1);
    if (next <= new Date(today.getFullYear(), today.getMonth() + 1, 1)) {
      setViewDate(next);
    }
  };

  const isSameDay = (a, b) => a && b &&
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const isInRange = (day) => {
    if (!startDate || !endDate) return false;
    const d = new Date(year, month, day);
    return d > startDate && d < endDate;
  };

  const isStart = (day) => startDate && isSameDay(new Date(year, month, day), startDate);
  const isEnd = (day) => endDate && isSameDay(new Date(year, month, day), endDate);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  if (rows[rows.length - 1]?.length < 7) {
    while (rows[rows.length - 1].length < 7) rows[rows.length - 1].push(null);
  }

  return (
    <View style={calStyles.container}>
      {/* Month nav */}
      <View style={calStyles.header}>
        <TouchableOpacity onPress={prevMonth} activeOpacity={0.6} style={calStyles.navBtn}>
          <Icon name="chevron-left" size={20} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={calStyles.monthLabel}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} activeOpacity={0.6} style={calStyles.navBtn}>
          <Icon name="chevron-right" size={20} color={DS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Day labels */}
      <View style={calStyles.dayRow}>
        {DAYS.map((d) => <Text key={d} style={calStyles.dayLabel}>{d}</Text>)}
      </View>

      {/* Date grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={calStyles.dayRow}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={calStyles.dayCell} />;

            const dateObj = new Date(year, month, day);
            dateObj.setHours(0, 0, 0, 0);
            const isFuture = dateObj > today;
            const start = isStart(day);
            const end = isEnd(day);
            const inRange = isInRange(day);
            const isToday = isSameDay(dateObj, today);

            return (
              <TouchableOpacity
                key={ci}
                style={[
                  calStyles.dayCell,
                  inRange && calStyles.dayCellInRange,
                  (start || end) && calStyles.dayCellSelected,
                ]}
                onPress={() => !isFuture && onSelect(dateObj)}
                activeOpacity={isFuture ? 1 : 0.6}
                disabled={isFuture}
              >
                <Text style={[
                  calStyles.dayText,
                  isFuture && { color: DS.border },
                  inRange && { color: DS.brandNavy },
                  (start || end) && { color: DS.textInverse, fontWeight: "700" },
                  isToday && !start && !end && calStyles.dayTextToday,
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Selection hint */}
      <Text style={calStyles.hint}>
        {selecting === "start" ? "Select start date" : selecting === "end" ? "Select end date" : "Tap a date to change range"}
      </Text>
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: { marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: DS.bgSurface2, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 16, fontWeight: "700", color: DS.textPrimary },
  dayRow: { flexDirection: "row" },
  dayLabel: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600", color: DS.textSecondary, paddingVertical: 8 },
  dayCell: { flex: 1, alignItems: "center", justifyContent: "center", height: 40, borderRadius: 20 },
  dayCellInRange: { backgroundColor: DS.brandNavy + "10", borderRadius: 0 },
  dayCellSelected: { backgroundColor: DS.brandNavy, borderRadius: 20 },
  dayText: { fontSize: 14, fontWeight: "500", color: DS.textPrimary },
  dayTextToday: { color: DS.brandBlue, fontWeight: "700" },
  hint: { fontSize: 12, fontWeight: "400", color: DS.textSecondary, textAlign: "center", marginTop: 8 },
});

// ─── Main Export Screen ──────────────────────────────────────

export default function ExportScreen({ navigation }) {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selecting, setSelecting] = useState("start");
  const [receiptCount, setReceiptCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Fetch receipt count when dates change
  useEffect(() => {
    if (startDate && endDate) fetchPreview();
    else { setReceiptCount(0); setTotalAmount(0); }
  }, [startDate, endDate]);

  const fetchPreview = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const endPlusOne = new Date(endDate);
      endPlusOne.setDate(endPlusOne.getDate() + 1);

      const { data, error } = await supabase
        .from("receipts")
        .select("total_amount")
        .eq("user_id", user.id)
        .gte("date", startDate.toISOString().split("T")[0])
        .lt("date", endPlusOne.toISOString().split("T")[0]);

      if (!error && data) {
        setReceiptCount(data.length);
        setTotalAmount(data.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0));
      }
    } catch (e) {
      console.error("Preview fetch error:", e);
    }
  };

  const handleDateSelect = (date) => {
    if (selecting === "start") {
      setStartDate(date);
      setEndDate(null);
      setSelecting("end");
    } else {
      if (date < startDate) {
        // Swap if end is before start
        setEndDate(startDate);
        setStartDate(date);
      } else {
        setEndDate(date);
      }
      setSelecting("done");
    }
  };

  const handleReset = () => {
    setStartDate(null);
    setEndDate(null);
    setSelecting("start");
    setReceiptCount(0);
    setTotalAmount(0);
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const handleExport = async () => {
    if (!startDate || !endDate) return;

    setExporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const endPlusOne = new Date(endDate);
      endPlusOne.setDate(endPlusOne.getDate() + 1);

      const { data: receipts, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", startDate.toISOString().split("T")[0])
        .lt("date", endPlusOne.toISOString().split("T")[0])
        .order("date", { ascending: true });

      if (error) throw new Error(error.message);
      if (!receipts || receipts.length === 0) {
        setErrorMessage("No receipts found in this date range.");
        setShowErrorModal(true);
        setExporting(false);
        return;
      }

      // Build Excel data
      const totalSpending = receipts.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0);
      const totalTax = receipts.reduce((s, r) => s + (parseFloat(r.tax_amount) || 0), 0);

      // Summary rows
      const summaryData = [
        ["BillBrain — Receipt Export"],
        [`Date Range: ${formatDate(startDate)} — ${formatDate(endDate)}`],
        [`Total Receipts: ${receipts.length}`],
        [`Total Spending: $${totalSpending.toFixed(2)}`],
        [`Total Tax: $${totalTax.toFixed(2)}`],
        [],
      ];

      // Header row
      const headers = ["Date", "Store Name", "Category", "Subtotal", "Discount", "Tax", "Total", "Payment Method"];

      // Data rows
      const rows = receipts.map((r) => {
        const date = r.date ? new Date(r.date).toLocaleDateString() : "";
        return [
          date,
          r.store_name || "Unknown",
          r.category || "Other",
          r.subtotal ? `$${parseFloat(r.subtotal).toFixed(2)}` : "—",
          r.discount_amount ? `$${parseFloat(r.discount_amount).toFixed(2)}` : "—",
          r.tax_amount ? `$${parseFloat(r.tax_amount).toFixed(2)}` : "—",
          `$${parseFloat(r.total_amount || 0).toFixed(2)}`,
          r.payment_method || "—",
        ];
      });

      // Create workbook
      const wsData = [...summaryData, headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      ws["!cols"] = [
        { wch: 12 }, // Date
        { wch: 24 }, // Store Name
        { wch: 14 }, // Category
        { wch: 12 }, // Subtotal
        { wch: 12 }, // Discount
        { wch: 12 }, // Tax
        { wch: 12 }, // Total
        { wch: 16 }, // Payment Method
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Receipts");

      // Write to file
      const wbOut = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const fileName = `BillBrain_Receipts_${startDate.toISOString().split("T")[0]}_to_${endDate.toISOString().split("T")[0]}.xlsx`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      await RNFS.writeFile(filePath, wbOut, "base64");

      // Open share sheet
      await Share.open({
        url: Platform.OS === "android" ? `file://${filePath}` : filePath,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: fileName,
      });

      setExporting(false);
      // Show success
      successScale.setValue(0);
      successOpacity.setValue(0);
      setShowSuccessModal(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }),
        Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        Animated.timing(successOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setShowSuccessModal(false);
        });
      }, 1500);
    } catch (e) {
      setExporting(false);
      // Share cancelled is not an error
      if (e.message?.includes("cancelled") || e.message?.includes("dismiss")) return;
      setErrorMessage("Failed to export: " + (e.message || "Unknown error"));
      setShowErrorModal(true);
    }
  };

  const canExport = startDate && endDate && receiptCount > 0;

  return (
    <SafeAreaView style={st.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Top Bar */}
      <View style={st.topBar}>
        <TouchableOpacity style={st.topBarBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={st.topBarTitle}>Export Documents</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false} bounces={true}>

        {/* Header */}
        <View style={st.headerSection}>
          <View style={st.headerIcon}>
            <Ionicons name="download-outline" size={28} color={DS.brandNavy} />
          </View>
          <Text style={st.headerTitle}>Export to Excel</Text>
          <Text style={st.headerSubtitle}>Select a date range to export your receipts as an Excel spreadsheet.</Text>
        </View>

        {/* Date Range Display */}
        <View style={st.dateRangeCard}>
          <View style={st.dateRangeRow}>
            <TouchableOpacity style={[st.dateBox, selecting === "start" && st.dateBoxActive]}
              onPress={() => setSelecting("start")} activeOpacity={0.7}>
              <Text style={st.dateBoxLabel}>FROM</Text>
              <Text style={[st.dateBoxValue, !startDate && { color: DS.textSecondary }]}>
                {formatDate(startDate)}
              </Text>
            </TouchableOpacity>

            <View style={st.dateArrow}>
              <Icon name="arrow-right" size={16} color={DS.textSecondary} />
            </View>

            <TouchableOpacity style={[st.dateBox, selecting === "end" && st.dateBoxActive]}
              onPress={() => startDate && setSelecting("end")} activeOpacity={0.7}>
              <Text style={st.dateBoxLabel}>TO</Text>
              <Text style={[st.dateBoxValue, !endDate && { color: DS.textSecondary }]}>
                {formatDate(endDate)}
              </Text>
            </TouchableOpacity>
          </View>

          {(startDate || endDate) && (
            <TouchableOpacity onPress={handleReset} activeOpacity={0.6} style={st.resetBtn}>
              <Icon name="refresh-cw" size={12} color={DS.negative} />
              <Text style={st.resetText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Calendar */}
        <View style={st.calendarCard}>
          <Calendar startDate={startDate} endDate={endDate} onSelect={handleDateSelect} selecting={selecting} />
        </View>

        {/* Preview */}
        {startDate && endDate && (
          <View style={st.previewCard}>
            <View style={st.previewRow}>
              <View style={st.previewItem}>
                <Ionicons name="receipt-outline" size={18} color={DS.brandNavy} />
                <Text style={st.previewValue}>{receiptCount}</Text>
                <Text style={st.previewLabel}>receipts</Text>
              </View>
              <View style={st.previewDivider} />
              <View style={st.previewItem}>
                <Ionicons name="wallet-outline" size={18} color={DS.accentGold} />
                <Text style={st.previewValue}>${totalAmount.toFixed(2)}</Text>
                <Text style={st.previewLabel}>total</Text>
              </View>
            </View>
          </View>
        )}

        {/* Export Button */}
        <TouchableOpacity
          style={[st.exportBtn, !canExport && { opacity: 0.4 }]}
          onPress={handleExport} activeOpacity={0.8} disabled={!canExport || exporting}>
          {exporting ? (
            <ActivityIndicator size="small" color={DS.textInverse} />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color={DS.textInverse} />
              <Text style={st.exportBtnText}>
                {canExport ? `Export ${receiptCount} Receipt${receiptCount !== 1 ? "s" : ""}` : "Select Date Range"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* File info */}
        <View style={st.fileInfo}>
          <Ionicons name="document-outline" size={14} color={DS.textSecondary} />
          <Text style={st.fileInfoText}>Exports as .xlsx (Excel) file</Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="none">
        <Animated.View style={[st.modalOverlay, { opacity: successOpacity }]}>
          <Animated.View style={[st.modalContent, { transform: [{ scale: successScale }] }]}>
            <View style={st.successCircle}>
              <Ionicons name="checkmark" size={28} color={DS.textInverse} />
            </View>
            <Text style={st.modalTitle}>Exported!</Text>
            <Text style={st.modalMessage}>Your receipts have been exported successfully.</Text>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Error Modal */}
      <Modal visible={showErrorModal} transparent animationType="fade" onRequestClose={() => setShowErrorModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={[st.modalIconCircle, { backgroundColor: DS.negative + "14" }]}>
              <Ionicons name="warning" size={24} color={DS.negative} />
            </View>
            <Text style={st.modalTitle}>Error</Text>
            <Text style={st.modalMessage}>{errorMessage}</Text>
            <TouchableOpacity style={st.modalBtnFull} onPress={() => setShowErrorModal(false)} activeOpacity={0.7}>
              <Text style={st.modalBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 8 : 8, paddingBottom: 12,
  },
  topBarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: DS.bgSurface2, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 17, fontWeight: "600", color: DS.textPrimary },

  // Header
  headerSection: { alignItems: "center", paddingVertical: 16 },
  headerIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: DS.brandNavy + "10",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: DS.textPrimary, letterSpacing: -0.2 },
  headerSubtitle: { fontSize: 14, fontWeight: "400", color: DS.textSecondary, textAlign: "center", marginTop: 6, lineHeight: 20, paddingHorizontal: 20 },

  // Date Range Card
  dateRangeCard: {
    backgroundColor: DS.bgSurface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: DS.border, marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 2 },
    }),
  },
  dateRangeRow: { flexDirection: "row", alignItems: "center" },
  dateBox: {
    flex: 1, backgroundColor: DS.bgSurface2, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: "transparent",
  },
  dateBoxActive: { borderColor: DS.brandNavy },
  dateBoxLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 1, color: DS.textSecondary, marginBottom: 4 },
  dateBoxValue: { fontSize: 15, fontWeight: "600", color: DS.textPrimary },
  dateArrow: { marginHorizontal: 10 },
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 12 },
  resetText: { fontSize: 12, fontWeight: "500", color: DS.negative },

  // Calendar Card
  calendarCard: {
    backgroundColor: DS.bgSurface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: DS.border, marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 2 },
    }),
  },

  // Preview Card
  previewCard: {
    backgroundColor: DS.bgSurface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: DS.border, marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 2 },
    }),
  },
  previewRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  previewItem: { flex: 1, alignItems: "center", gap: 4 },
  previewValue: { fontSize: 20, fontWeight: "700", color: DS.textPrimary },
  previewLabel: { fontSize: 12, fontWeight: "400", color: DS.textSecondary },
  previewDivider: { width: 1, height: 40, backgroundColor: DS.border },

  // Export Button
  exportBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 54, borderRadius: 999, gap: 8, backgroundColor: DS.brandNavy,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },
  exportBtnText: { fontSize: 15, fontWeight: "600", color: DS.textInverse },

  // File info
  fileInfo: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 },
  fileInfoText: { fontSize: 12, fontWeight: "400", color: DS.textSecondary },

  // Modals
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 32 },
  modalContent: { width: "100%", borderRadius: 24, padding: 28, alignItems: "center", backgroundColor: DS.bgSurface },
  modalIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8, color: DS.textPrimary },
  modalMessage: { fontSize: 14, fontWeight: "400", textAlign: "center", lineHeight: 20, marginBottom: 24, color: DS.textSecondary },
  modalBtnFull: { width: "100%", height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DS.brandNavy },
  modalBtnText: { fontSize: 15, fontWeight: "600", color: DS.textInverse },
  successCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: DS.positive, alignItems: "center", justifyContent: "center", marginBottom: 16 },
});