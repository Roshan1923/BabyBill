import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  StatusBar,
  SafeAreaView,
  Animated,
  Modal,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../config/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Design System Tokens (same as HomeScreen) ──────────────
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
  cardPad:       20,
  cardRadius:    20,
  buttonHeight:  52,
  iconBox:       40,
  iconRadius:    12,
  navHeight:     80,
};

const TAGS = ["All", "Food", "Bills", "Gas", "Shopping", "Medical", "Other"];

// ─── Date Grouping Helper ────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getDateGroup(dateStr) {
  if (!dateStr) return "Unknown Date";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const receiptDate = new Date(dateStr);
  if (isNaN(receiptDate.getTime())) return "Unknown Date";

  const receiptDay = new Date(
    receiptDate.getFullYear(),
    receiptDate.getMonth(),
    receiptDate.getDate()
  );

  if (receiptDay.getTime() === today.getTime()) return "Today";
  if (receiptDay.getTime() === yesterday.getTime()) return "Yesterday";

  // Show actual date for everything else: "Jan 29, 2026"
  return `${MONTHS[receiptDate.getMonth()]} ${receiptDate.getDate()}, ${receiptDate.getFullYear()}`;
}

function groupReceipts(receipts) {
  const groups = {};
  const groupDates = {}; // track actual Date for sorting

  receipts.forEach((r) => {
    const group = getDateGroup(r.date || r.created_at);
    if (!groups[group]) {
      groups[group] = [];
      // Store the date for sorting (Today = today, Yesterday = yesterday, else parse)
      const d = new Date(r.date || r.created_at);
      groupDates[group] = isNaN(d.getTime()) ? new Date(0) : d;
    }
    groups[group].push(r);
  });

  // Sort group keys: Today first, Yesterday second, then by date descending
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === "Today") return -1;
    if (b === "Today") return 1;
    if (a === "Yesterday") return -1;
    if (b === "Yesterday") return 1;
    if (a === "Unknown Date") return 1;
    if (b === "Unknown Date") return -1;
    // Sort by actual date descending (newest first)
    return (groupDates[b]?.getTime() || 0) - (groupDates[a]?.getTime() || 0);
  });

  // Build flat list with section headers
  const sections = [];
  sortedKeys.forEach((groupName) => {
    sections.push({ type: "header", title: groupName, id: `header-${groupName}` });
    groups[groupName].forEach((r) => {
      sections.push({ type: "receipt", data: r, id: r.id });
    });
  });
  return sections;
}

// ─── Date Range Picker Modal ─────────────────────────────────

const DATE_RANGES = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "Last 7 Days", value: "7days" },
  { label: "Last 30 Days", value: "30days" },
  { label: "Last 3 Months", value: "3months" },
  { label: "Last 6 Months", value: "6months" },
  { label: "This Year", value: "year" },
];

function DateRangeModal({ visible, onClose, selected, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Date Range</Text>
          {DATE_RANGES.map((range) => {
            const active = selected === range.value;
            return (
              <TouchableOpacity
                key={range.value}
                style={[styles.modalOption, active && styles.modalOptionActive]}
                onPress={() => {
                  onSelect(range.value);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>
                  {range.label}
                </Text>
                {active && <Ionicons name="checkmark" size={18} color={DS.brandNavy} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Animated Receipt Row ────────────────────────────────────

function ReceiptRow({ item, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  // Format amount with $ sign
  const amount = `$${parseFloat(item.total_amount || 0).toFixed(2)}`;

  // Format date for display
  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  // Category icon mapping
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

  // Category color mapping
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

  const iconName = getCategoryIcon(item.category);
  const iconColor = getCategoryColor(item.category);
  const iconBg = iconColor + "18"; // 18 = ~10% opacity hex

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start()
      }
      onPress={onPress}
    >
      <Animated.View style={[styles.receiptRow, { transform: [{ scale }] }]}>
        <View style={styles.receiptLeft}>
          <View style={[styles.receiptIconBox, { backgroundColor: iconBg }]}>
            <Ionicons name={iconName} size={18} color={iconColor} />
          </View>
          <View style={styles.receiptTextBlock}>
            <Text style={styles.receiptName} numberOfLines={1}>
              {item.store_name || "Unknown Store"}
            </Text>
            <Text style={styles.receiptMeta}>
              {item.category || "Other"}
              {item.date ? `  ·  ${formatTime(item.date)}` : ""}
            </Text>
          </View>
        </View>
        <View style={styles.receiptRight}>
          <Text style={styles.receiptAmount}>{amount}</Text>
          <Icon name="chevron-right" size={16} color={DS.textSecondary} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Empty State ─────────────────────────────────────────────

function EmptyState({ hasFilters }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="receipt-outline" size={36} color={DS.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>
        {hasFilters ? "No matching receipts" : "No receipts yet"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {hasFilters
          ? "Try adjusting your search or filters"
          : "Tap the scan button to capture your first receipt"}
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function ReceiptsScreen({ navigation }) {
  const [receipts, setReceipts] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [activeTag, setActiveTag] = useState("All");
  const [dateRange, setDateRange] = useState("all");
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Fetch from Supabase ──
  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Supabase error:", error.message);
      } else {
        setReceipts(data || []);
      }
    } catch (err) {
      console.log("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchReceipts();
    }, [])
  );

  // ── Filter logic ──
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      // Search filter
      const matchesSearch =
        searchText === "" ||
        (r.store_name || "").toLowerCase().includes(searchText.toLowerCase());

      // Category filter
      const matchesTag = activeTag === "All" || r.category === activeTag;

      // Date range filter
      let matchesDate = true;
      if (dateRange !== "all" && r.date) {
        const now = new Date();
        const receiptDate = new Date(r.date);
        if (!isNaN(receiptDate.getTime())) {
          switch (dateRange) {
            case "today": {
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              matchesDate = receiptDate >= today;
              break;
            }
            case "7days": {
              const d = new Date(now);
              d.setDate(d.getDate() - 7);
              matchesDate = receiptDate >= d;
              break;
            }
            case "30days": {
              const d = new Date(now);
              d.setDate(d.getDate() - 30);
              matchesDate = receiptDate >= d;
              break;
            }
            case "3months": {
              const d = new Date(now);
              d.setMonth(d.getMonth() - 3);
              matchesDate = receiptDate >= d;
              break;
            }
            case "6months": {
              const d = new Date(now);
              d.setMonth(d.getMonth() - 6);
              matchesDate = receiptDate >= d;
              break;
            }
            case "year": {
              const yearStart = new Date(now.getFullYear(), 0, 1);
              matchesDate = receiptDate >= yearStart;
              break;
            }
          }
        }
      }

      return matchesSearch && matchesTag && matchesDate;
    });
  }, [receipts, searchText, activeTag, dateRange]);

  // ── Group into sections ──
  const sections = useMemo(() => groupReceipts(filteredReceipts), [filteredReceipts]);

  const hasFilters = searchText !== "" || activeTag !== "All" || dateRange !== "all";

  // ── Get date range label ──
  const dateRangeLabel = DATE_RANGES.find((r) => r.value === dateRange)?.label || "All Time";

  // ── Receipt count summary ──
  const totalAmount = filteredReceipts
    .reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0)
    .toFixed(2);

  // ── Render ──
  const renderItem = ({ item }) => {
    if (item.type === "header") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
        </View>
      );
    }
    return (
      <ReceiptRow
        item={item.data}
        onPress={() => navigation.navigate("Detail", { receipt: item.data })}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Receipts</Text>
        <View style={styles.headerRight}>
          <Text style={styles.receiptCount}>
            {filteredReceipts.length} receipt{filteredReceipts.length !== 1 ? "s" : ""}
          </Text>
          <Text style={styles.totalBadge}>${totalAmount}</Text>
        </View>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search" size={16} color={DS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by store name..."
            placeholderTextColor={DS.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          {searchText !== "" && (
            <TouchableOpacity onPress={() => setSearchText("")} activeOpacity={0.6}>
              <Icon name="x" size={16} color={DS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filter Row: Tags + Date Range ── */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TAGS}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.tagsContainer}
          renderItem={({ item }) => {
            const active = activeTag === item;
            return (
              <TouchableOpacity
                onPress={() => setActiveTag(item)}
                style={[styles.tagPill, active && styles.tagPillActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.tagText, active && styles.tagTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ── Date Range Button ── */}
      <View style={styles.dateRangeRow}>
        <TouchableOpacity
          style={styles.dateRangeBtn}
          onPress={() => setDateModalVisible(true)}
          activeOpacity={0.7}
        >
          <Icon name="calendar" size={14} color={DS.brandNavy} />
          <Text style={styles.dateRangeText}>{dateRangeLabel}</Text>
          <Icon name="chevron-down" size={14} color={DS.textSecondary} />
        </TouchableOpacity>

        {hasFilters && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => {
              setSearchText("");
              setActiveTag("All");
              setDateRange("all");
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.clearBtnText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Receipt List ── */}
      <FlatList
        data={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          sections.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState hasFilters={hasFilters} />}
        onRefresh={fetchReceipts}
        refreshing={loading}
      />

      {/* ── Date Range Modal ── */}
      <DateRangeModal
        visible={dateModalVisible}
        onClose={() => setDateModalVisible(false)}
        selected={dateRange}
        onSelect={setDateRange}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DS.bgPage,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: DS.pagePad,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 10 : 12,
    paddingBottom: 4,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: DS.textPrimary,
    letterSpacing: -0.3,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  receiptCount: {
    fontSize: 12,
    fontWeight: "500",
    color: DS.textSecondary,
  },
  totalBadge: {
    fontSize: 16,
    fontWeight: "700",
    color: DS.brandNavy,
    marginTop: 1,
  },

  // ── Search ──
  searchContainer: {
    paddingHorizontal: DS.pagePad,
    marginTop: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DS.bgSurface,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: DS.border,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: DS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
    color: DS.textPrimary,
    paddingVertical: 0,
  },

  // ── Filter Row ──
  filterRow: {
    marginTop: 12,
  },
  tagsContainer: {
    paddingHorizontal: DS.pagePad,
    gap: 8,
  },
  tagPill: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: DS.bgSurface,
    borderWidth: 1,
    borderColor: DS.border,
  },
  tagPillActive: {
    backgroundColor: DS.brandNavy,
    borderColor: DS.brandNavy,
  },
  tagText: {
    fontSize: 13,
    fontWeight: "600",
    color: DS.textSecondary,
  },
  tagTextActive: {
    color: DS.textInverse,
  },

  // ── Date Range Row ──
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: DS.pagePad,
    marginTop: 10,
    marginBottom: 4,
  },
  dateRangeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DS.bgSurface,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: DS.border,
  },
  dateRangeText: {
    fontSize: 13,
    fontWeight: "600",
    color: DS.brandNavy,
  },
  clearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: DS.negative,
  },

  // ── Section Headers ──
  sectionHeader: {
    paddingHorizontal: DS.pagePad,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: DS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // ── Receipt Rows ──
  receiptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: DS.pagePad,
    marginHorizontal: DS.pagePad,
    marginVertical: 2,
    backgroundColor: DS.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DS.border,
    ...Platform.select({
      ios: {
        shadowColor: DS.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.6,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  receiptLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  receiptIconBox: {
    width: DS.iconBox,
    height: DS.iconBox,
    borderRadius: DS.iconRadius,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptTextBlock: {
    marginLeft: 12,
    flex: 1,
  },
  receiptName: {
    fontSize: 15,
    fontWeight: "600",
    color: DS.textPrimary,
  },
  receiptMeta: {
    fontSize: 12,
    fontWeight: "400",
    color: DS.textSecondary,
    marginTop: 3,
  },
  receiptRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 8,
  },
  receiptAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: DS.textPrimary,
  },

  // ── List ──
  listContent: {
    paddingBottom: DS.navHeight + 24,
  },
  listContentEmpty: {
    flexGrow: 1,
  },

  // ── Empty State ──
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: DS.bgSurface2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: DS.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: DS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: DS.bgSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    paddingHorizontal: DS.pagePad,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: DS.textPrimary,
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  modalOptionActive: {
    backgroundColor: DS.accentGoldSub,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: -8,
    borderBottomWidth: 0,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: "500",
    color: DS.textPrimary,
  },
  modalOptionTextActive: {
    fontWeight: "700",
    color: DS.brandNavy,
  },
});