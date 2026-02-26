/* eslint-disable react-native/no-inline-styles */
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";
import { supabase } from "../config/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Design System Tokens ────────────────────────────────────
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
  cardRadius:    20,
};

const CATEGORIES = ["Food", "Bills", "Gas", "Shopping", "Medical", "Other"];

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

// ─── Main Screen ─────────────────────────────────────────────

export default function ManualEntryScreen({ navigation }) {
  const [saving, setSaving] = useState(false);

  // Receipt fields
  const [storeName, setStoreName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("Other");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [tax, setTax] = useState("");
  const [discount, setDiscount] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);

  // Modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [duplicateUserId, setDuplicateUserId] = useState(null);
  const [savingDuplicate, setSavingDuplicate] = useState(false);

  // Success animation
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  const playSuccessAnimation = () => {
    successScale.setValue(0);
    successOpacity.setValue(0);
    checkScale.setValue(0);
    setShowSuccessModal(true);
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }),
      Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 10 }).start();
      setTimeout(() => {
        Animated.timing(successOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
          setShowSuccessModal(false);
          navigation.navigate("Main", { screen: "Home" });
        });
      }, 1500);
    });
  };

  // Item management
  const addItem = () => {
    setItems([...items, { name: "", price: "", quantity: 1 }]);
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Duplicate check
  const checkDuplicate = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("receipts")
        .select("id")
        .eq("user_id", userId)
        .eq("store_name", storeName.trim())
        .eq("date", date)
        .eq("total_amount", parseFloat(totalAmount) || 0);

      if (error) return false;
      return data && data.length > 0;
    } catch (err) {
      return false;
    }
  };

  // Save receipt to Supabase
  const saveReceipt = async (userId) => {
    const { error } = await supabase.from("receipts").insert({
      user_id: userId,
      store_name: storeName.trim(),
      date: date || new Date().toISOString().split("T")[0],
      category: category,
      payment_method: paymentMethod || "Unknown",
      subtotal: subtotal || 0,
      tax: tax || 0,
      discount: discount || 0,
      total_amount: totalAmount || 0,
      items: items
        .filter((i) => i.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          price: parseFloat(item.price) || 0,
          quantity: parseInt(item.quantity, 10) || 1,
        })),
      notes: notes,
      status: "completed",
      image_url: "",
      raw_text: "",
    });

    return error;
  };

  // Main save handler
  const handleSave = async () => {
    if (!storeName.trim()) {
      setValidationMessage("Please enter a store name to continue.");
      setShowValidationModal(true);
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSaving(false);
        setErrorMessage("You must be logged in to save receipts.");
        setShowErrorModal(true);
        return;
      }

      const isDuplicate = await checkDuplicate(user.id);

      if (isDuplicate) {
        setSaving(false);
        setDuplicateUserId(user.id);
        setShowDuplicateModal(true);
        return;
      }

      const error = await saveReceipt(user.id);
      if (error) {
        setErrorMessage("Failed to save receipt. Please try again.");
        setShowErrorModal(true);
      } else {
        playSuccessAnimation();
      }
    } catch (err) {
      setErrorMessage("Failed to save receipt. Please try again.");
      setShowErrorModal(true);
    } finally {
      setSaving(false);
    }
  };

  // Save duplicate anyway
  const handleSaveDuplicate = async () => {
    setSavingDuplicate(true);
    try {
      const error = await saveReceipt(duplicateUserId);
      setShowDuplicateModal(false);
      setSavingDuplicate(false);
      if (error) {
        setErrorMessage("Failed to save receipt. Please try again.");
        setShowErrorModal(true);
      } else {
        playSuccessAnimation();
      }
    } catch (err) {
      setShowDuplicateModal(false);
      setSavingDuplicate(false);
      setErrorMessage("Failed to save receipt. Please try again.");
      setShowErrorModal(true);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ── Top Bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topBarBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-left" size={20} color={DS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Add Receipt</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* ── Store Details ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="storefront-outline" size={18} color={DS.brandNavy} />
              <Text style={styles.sectionTitle}>Store Details</Text>
            </View>

            <Text style={styles.fieldLabel}>Store Name *</Text>
            <TextInput
              style={styles.input}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="Enter store name"
              placeholderTextColor={DS.textSecondary}
            />
            <View style={styles.fieldDivider} />

            <Text style={styles.fieldLabel}>Date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={DS.textSecondary}
            />
            <View style={styles.fieldDivider} />

            <Text style={styles.fieldLabel}>Payment Method</Text>
            <TextInput
              style={styles.input}
              value={paymentMethod}
              onChangeText={setPaymentMethod}
              placeholder="Cash, Credit Card, Debit Card..."
              placeholderTextColor={DS.textSecondary}
            />
          </View>

          {/* ── Category ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="pricetag-outline" size={18} color={DS.brandNavy} />
              <Text style={styles.sectionTitle}>Category</Text>
            </View>

            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                const color = getCategoryColor(cat);
                const icon = getCategoryIcon(cat);
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      active && { backgroundColor: color + "18", borderColor: color },
                    ]}
                    onPress={() => setCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={icon} size={14} color={active ? color : DS.textSecondary} />
                    <Text
                      style={[
                        styles.categoryText,
                        active && { color: color, fontWeight: "700" },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Items ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="list-outline" size={18} color={DS.brandNavy} />
              <Text style={[styles.sectionTitle, { flex: 1 }]}>Items</Text>
              <TouchableOpacity style={styles.addItemBtn} onPress={addItem} activeOpacity={0.7}>
                <Icon name="plus" size={14} color={DS.brandBlue} />
                <Text style={styles.addItemBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {items.length > 0 ? (
              items.map((item, index) => (
                <View key={index}>
                  <View style={styles.itemEntry}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={[styles.input, { marginBottom: 8 }]}
                        value={item.name}
                        onChangeText={(text) => updateItem(index, "name", text)}
                        placeholder="Item name"
                        placeholderTextColor={DS.textSecondary}
                      />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          value={item.price}
                          onChangeText={(text) => updateItem(index, "price", text)}
                          placeholder="Price"
                          placeholderTextColor={DS.textSecondary}
                          keyboardType="decimal-pad"
                        />
                        <TextInput
                          style={[styles.input, { width: 60 }]}
                          value={item.quantity.toString()}
                          onChangeText={(text) => updateItem(index, "quantity", text)}
                          placeholder="Qty"
                          placeholderTextColor={DS.textSecondary}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.removeItemBtn}
                      onPress={() => removeItem(index)}
                      activeOpacity={0.7}
                    >
                      <Icon name="x" size={14} color={DS.negative} />
                    </TouchableOpacity>
                  </View>
                  {index < items.length - 1 && <View style={styles.fieldDivider} />}
                </View>
              ))
            ) : (
              <View style={styles.emptyItems}>
                <Ionicons name="receipt-outline" size={24} color={DS.textSecondary} />
                <Text style={styles.emptyItemsText}>No items added yet</Text>
              </View>
            )}
          </View>

          {/* ── Price Breakdown ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="calculator-outline" size={18} color={DS.brandNavy} />
              <Text style={styles.sectionTitle}>Price Breakdown</Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Subtotal</Text>
              <TextInput
                style={styles.priceInput}
                value={subtotal}
                onChangeText={setSubtotal}
                placeholder="0.00"
                placeholderTextColor={DS.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Discount</Text>
              <TextInput
                style={styles.priceInput}
                value={discount}
                onChangeText={setDiscount}
                placeholder="0.00"
                placeholderTextColor={DS.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Tax</Text>
              <TextInput
                style={styles.priceInput}
                value={tax}
                onChangeText={setTax}
                placeholder="0.00"
                placeholderTextColor={DS.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <TextInput
                style={[styles.priceInput, styles.totalInput]}
                value={totalAmount}
                onChangeText={setTotalAmount}
                placeholder="0.00"
                placeholderTextColor={DS.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* ── Notes ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="create-outline" size={18} color={DS.brandNavy} />
              <Text style={styles.sectionTitle}>Notes</Text>
            </View>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about this receipt..."
              placeholderTextColor={DS.textSecondary}
              multiline
            />
          </View>
        </ScrollView>

        {/* ── Save Button ── */}
        <View style={styles.saveContainer}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={DS.textInverse} />
            ) : (
              <>
                <Icon name="check" size={18} color={DS.textInverse} style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Save Receipt</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Validation Modal ── */}
      <Modal visible={showValidationModal} animationType="fade" transparent>
        <View style={styles.customModalOverlay}>
          <View style={styles.customModalCard}>
            <View style={styles.warningIconCircle}>
              <Ionicons name="alert-outline" size={28} color={DS.accentGold} />
            </View>
            <Text style={styles.customModalTitle}>Missing Information</Text>
            <Text style={styles.customModalMessage}>{validationMessage}</Text>
            <TouchableOpacity
              style={styles.customModalBtnPrimary}
              onPress={() => setShowValidationModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.customModalBtnPrimaryText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Duplicate Modal ── */}
      <Modal visible={showDuplicateModal} animationType="fade" transparent>
        <View style={styles.customModalOverlay}>
          <View style={styles.customModalCard}>
            <View style={styles.duplicateIconCircle}>
              <Ionicons name="copy-outline" size={28} color={DS.accentGold} />
            </View>
            <Text style={styles.customModalTitle}>Duplicate Receipt</Text>
            <Text style={styles.customModalMessage}>
              A receipt from{" "}
              <Text style={{ fontWeight: "700", color: DS.textPrimary }}>{storeName.trim()}</Text>
              {" "}on {date} for ${parseFloat(totalAmount) || 0} already exists.{"\n\n"}
              Would you like to save it anyway?
            </Text>
            <View style={styles.customModalButtons}>
              <TouchableOpacity
                style={styles.customModalBtnSecondary}
                onPress={() => setShowDuplicateModal(false)}
                activeOpacity={0.7}
                disabled={savingDuplicate}
              >
                <Text style={styles.customModalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.customModalBtnGold, savingDuplicate && { opacity: 0.5 }]}
                onPress={handleSaveDuplicate}
                activeOpacity={0.7}
                disabled={savingDuplicate}
              >
                {savingDuplicate ? (
                  <ActivityIndicator size="small" color={DS.textInverse} />
                ) : (
                  <Text style={styles.customModalBtnGoldText}>Save Anyway</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Success Modal ── */}
      <Modal visible={showSuccessModal} animationType="none" transparent>
        <Animated.View style={[styles.customModalOverlay, { opacity: successOpacity }]}>
          <Animated.View
            style={[
              styles.successModalCard,
              { transform: [{ scale: successScale }] },
            ]}
          >
            <Animated.View
              style={[
                styles.successIconCircle,
                { transform: [{ scale: checkScale }] },
              ]}
            >
              <Icon name="check" size={32} color={DS.textInverse} />
            </Animated.View>
            <Text style={styles.successTitle}>Saved!</Text>
            <Text style={styles.successMessage}>Receipt added successfully</Text>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* ── Error Modal ── */}
      <Modal visible={showErrorModal} animationType="fade" transparent>
        <View style={styles.customModalOverlay}>
          <View style={styles.customModalCard}>
            <View style={styles.errorIconCircle}>
              <Icon name="alert-triangle" size={28} color={DS.negative} />
            </View>
            <Text style={styles.customModalTitle}>Something went wrong</Text>
            <Text style={styles.customModalMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.customModalBtnPrimary}
              onPress={() => setShowErrorModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.customModalBtnPrimaryText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DS.bgPage,
  },

  // ── Top Bar ──
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: DS.pagePad,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 6 : 8,
    paddingBottom: 8,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: DS.textPrimary,
  },

  // ── Scroll ──
  scrollContent: {
    paddingHorizontal: DS.pagePad,
    paddingBottom: 100,
  },

  // ── Section Cards ──
  sectionCard: {
    backgroundColor: DS.bgSurface,
    borderRadius: DS.cardRadius,
    padding: 20,
    marginTop: 14,
    borderWidth: 1,
    borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.8, shadowRadius: 12 },
      android: { elevation: 1 },
    }),
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: DS.textPrimary,
  },

  // ── Fields ──
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: DS.textSecondary,
    marginBottom: 4,
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  input: {
    fontSize: 15,
    fontWeight: "500",
    color: DS.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: DS.bgSurface2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DS.border,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: DS.border,
    marginVertical: 8,
  },

  // ── Category ──
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DS.bgSurface2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DS.border,
    gap: 6,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
    color: DS.textSecondary,
  },

  // ── Items ──
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DS.bgSurface2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DS.border,
    gap: 4,
  },
  addItemBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: DS.brandBlue,
  },
  itemEntry: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  removeItemBtn: {
    marginLeft: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DS.negative + "14",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyItems: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 6,
  },
  emptyItemsText: {
    fontSize: 14,
    fontWeight: "400",
    color: DS.textSecondary,
  },

  // ── Price Breakdown ──
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: DS.textSecondary,
  },
  priceInput: {
    fontSize: 15,
    fontWeight: "600",
    color: DS.textPrimary,
    textAlign: "right",
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: DS.bgSurface2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DS.border,
    width: 110,
  },
  totalDivider: {
    height: 2,
    backgroundColor: DS.brandNavy,
    marginTop: 4,
    borderRadius: 1,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: DS.textPrimary,
    letterSpacing: 0.5,
  },
  totalInput: {
    fontSize: 16,
    fontWeight: "800",
    color: DS.accentGold,
  },

  // ── Notes ──
  notesInput: {
    fontSize: 14,
    color: DS.textPrimary,
    minHeight: 80,
    textAlignVertical: "top",
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: DS.bgSurface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DS.border,
  },

  // ── Save Button ──
  saveContainer: {
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
    backgroundColor: DS.bgPage,
    borderTopWidth: 1,
    borderTopColor: DS.border,
  },
  saveBtn: {
    backgroundColor: DS.positive,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    ...Platform.select({
      ios: { shadowColor: "rgba(42,140,92,0.35)", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    color: DS.textInverse,
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Custom Modals ──
  customModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  customModalCard: {
    backgroundColor: DS.bgSurface,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "rgba(0,0,0,0.25)", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 30 },
      android: { elevation: 12 },
    }),
  },
  warningIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DS.accentGoldSub,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  duplicateIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DS.accentGoldSub,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#C8402A18",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  customModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: DS.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  customModalMessage: {
    fontSize: 14,
    fontWeight: "400",
    color: DS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  customModalButtons: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  customModalBtnSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: DS.bgSurface2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: DS.border,
  },
  customModalBtnSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: DS.textPrimary,
  },
  customModalBtnGold: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: DS.accentGold,
    alignItems: "center",
    justifyContent: "center",
  },
  customModalBtnGoldText: {
    fontSize: 15,
    fontWeight: "600",
    color: DS.textInverse,
  },
  customModalBtnPrimary: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    backgroundColor: DS.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  customModalBtnPrimaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: DS.textInverse,
  },

  // ── Success Modal ──
  successModalCard: {
    backgroundColor: DS.bgSurface,
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 24,
    width: "80%",
    alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "rgba(0,0,0,0.25)", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 30 },
      android: { elevation: 12 },
    }),
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: DS.positive,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: DS.textPrimary,
    marginBottom: 4,
  },
  successMessage: {
    fontSize: 14,
    fontWeight: "400",
    color: DS.textSecondary,
  },
});