/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  LayoutAnimation,
  UIManager,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../config/supabase";
import AddCategoryModal from "../components/AddCategoryModal";
import ZoomableImage from "../components/ZoomableImage.jsx";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

// ─── Category Helpers (dynamic with fallback) ────────────────
const FALLBACK_ICON = "receipt-outline";
const FALLBACK_COLOR = "#8A7E72";

const getCategoryIcon = (cat, categories) => {
  if (categories && categories.length > 0) {
    const match = categories.find(
      (c) => c.name.toLowerCase() === (cat || "").toLowerCase()
    );
    if (match) return match.icon;
  }
  switch ((cat || "").toLowerCase()) {
    case "food": return "restaurant-outline";
    case "bills": return "document-text-outline";
    case "gas": return "car-outline";
    case "shopping": return "bag-outline";
    case "medical": return "medical-outline";
    default: return FALLBACK_ICON;
  }
};

const getCategoryColor = (cat, categories) => {
  if (categories && categories.length > 0) {
    const match = categories.find(
      (c) => c.name.toLowerCase() === (cat || "").toLowerCase()
    );
    if (match) return match.color;
  }
  switch ((cat || "").toLowerCase()) {
    case "food": return "#E8A020";
    case "bills": return "#2563C8";
    case "gas": return "#C8402A";
    case "shopping": return "#7C3AED";
    case "medical": return "#2A8C5C";
    default: return FALLBACK_COLOR;
  }
};

// ─── Editable Field Component ────────────────────────────────

const Field = ({ label, value, onChangeText, keyboardType = "default", editing = false, valueStyle = {}, icon }) => (
  <View style={styles.fieldRow}>
    <View style={styles.fieldLeft}>
      {icon && (
        <Ionicons name={icon} size={16} color={DS.textSecondary} style={{ marginRight: 8 }} />
      )}
      <Text style={styles.fieldLabel}>{label}</Text>
    </View>
    {editing ? (
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        selectTextOnFocus
      />
    ) : (
      <Text style={[styles.fieldValue, valueStyle]}>{value || "—"}</Text>
    )}
  </View>
);

// ─── Category Picker Component ───────────────────────────────

function CategoryPicker({ categories, selected, onSelect, onAddNew }) {
  return (
    <View style={styles.categoryPickerContainer}>
      <View style={styles.fieldLeft}>
        <Ionicons name="pricetag-outline" size={16} color={DS.textSecondary} style={{ marginRight: 8 }} />
        <Text style={styles.fieldLabel}>Category</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryChipsRow}
        style={styles.categoryChipsScroll}
      >
        {categories.map((cat) => {
          const isActive = selected.toLowerCase() === cat.name.toLowerCase();
          const catColor = cat.color || FALLBACK_COLOR;
          return (
            <TouchableOpacity
              key={cat.name}
              style={[
                styles.categoryChip,
                isActive
                  ? { backgroundColor: catColor + "20", borderColor: catColor }
                  : { backgroundColor: DS.bgSurface2, borderColor: DS.border },
              ]}
              onPress={() => onSelect(cat.name)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={cat.icon || FALLBACK_ICON}
                size={14}
                color={isActive ? catColor : DS.textSecondary}
              />
              <Text
                style={[
                  styles.categoryChipText,
                  { color: isActive ? catColor : DS.textSecondary },
                  isActive && { fontWeight: "700" },
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* ── Add New Category Chip ── */}
        <TouchableOpacity
          style={styles.addCategoryChip}
          onPress={onAddNew}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={16} color={DS.brandBlue} />
          <Text style={styles.addCategoryChipText}>New</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function DetailScreen({ route, navigation }) {
  const { receipt } = route.params;

  // Image state
  const [imageUrl, setImageUrl] = useState(null);
  const [loadingImage, setLoadingImage] = useState(true);
  const [showFullImage, setShowFullImage] = useState(false);

  // UI state
  const [showOCR, setShowOCR] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Dynamic categories
  const [categories, setCategories] = useState([]);
  const [addCatModalVisible, setAddCatModalVisible] = useState(false);

  // Success modal animation
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
        });
      }, 1500);
    });
  };

  // Editable fields
  const [storeName, setStoreName] = useState(receipt.store_name || "");
  const [date, setDate] = useState(receipt.date || "");
  const [category, setCategory] = useState(receipt.category || "");
  const [paymentMethod, setPaymentMethod] = useState(receipt.payment_method || "");
  const [subtotal, setSubtotal] = useState(receipt.subtotal?.toString() || "0.00");
  const [tax, setTax] = useState(receipt.tax?.toString() || "0.00");
  const [discount, setDiscount] = useState(receipt.discount?.toString() || "0.00");
  const [totalAmount, setTotalAmount] = useState(receipt.total_amount?.toString() || "0.00");
  const [items, setItems] = useState(
    (receipt.items || []).map((item) => ({
      name: item.name || "",
      price: item.price?.toString() || "0.00",
      quantity: item.quantity || 1,
    }))
  );
  const [notes, setNotes] = useState(receipt.notes || "");

  // Animation
  const heroScale = useRef(new Animated.Value(0.95)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(heroScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 4 }),
      Animated.timing(heroOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  // Fetch user categories — useFocusEffect re-fetches on focus
  const fetchCategories = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("user_categories")
        .select("name, icon, color")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (!error && data && data.length > 0) {
        setCategories(data);
      }
    } catch (err) {
      console.log("Error fetching categories:", err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [fetchCategories])
  );

  // When a new category is added via inline modal
  const handleCategoryAdded = (newCat) => {
    setCategories((prev) => [...prev, newCat]);
    setCategory(newCat.name);
  };

  // Update an item field
  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Cancel editing
  const handleCancel = () => {
    setStoreName(receipt.store_name || "");
    setDate(receipt.date || "");
    setCategory(receipt.category || "");
    setPaymentMethod(receipt.payment_method || "");
    setSubtotal(receipt.subtotal?.toString() || "0.00");
    setTax(receipt.tax?.toString() || "0.00");
    setDiscount(receipt.discount?.toString() || "0.00");
    setTotalAmount(receipt.total_amount?.toString() || "0.00");
    setItems(
      (receipt.items || []).map((item) => ({
        name: item.name || "",
        price: item.price?.toString() || "0.00",
        quantity: item.quantity || 1,
      }))
    );
    setNotes(receipt.notes || "");
    setEditing(false);
  };

  // Save to Supabase
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("receipts")
        .update({
          store_name: storeName,
          date: date,
          category: category,
          payment_method: paymentMethod,
          subtotal: parseFloat(subtotal) || 0,
          tax: parseFloat(tax) || 0,
          discount: parseFloat(discount) || 0,
          total_amount: parseFloat(totalAmount) || 0,
          items: items.map((item) => ({
            name: item.name,
            price: parseFloat(item.price) || 0,
            quantity: item.quantity,
          })),
          notes: notes,
        })
        .eq("id", receipt.id);

      if (error) {
        setErrorMessage("Failed to save changes. Please try again.");
        setShowErrorModal(true);
      } else {
        setEditing(false);
        playSuccessAnimation();
      }
    } catch (err) {
      setErrorMessage("Failed to save changes. Please try again.");
      setShowErrorModal(true);
    } finally {
      setSaving(false);
    }
  };

  // Load receipt image
  useEffect(() => {
    const loadImage = async () => {
      if (receipt.image_url) {
        try {
          const filePath = receipt.image_url.replace("receipt-images/", "");
          const { data } = await supabase.storage
            .from("receipt-images")
            .createSignedUrl(filePath, 3600);
          if (data?.signedUrl) setImageUrl(data.signedUrl);
        } catch (err) {
          console.log("Image load error:", err);
        }
      }
      setLoadingImage(false);
    };
    loadImage();
  }, [receipt.image_url]);

  // Delete receipt
  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("receipts").delete().eq("id", receipt.id);
      if (error) {
        setShowDeleteModal(false);
        setDeleting(false);
        setErrorMessage("Failed to delete receipt.");
        setShowErrorModal(true);
      } else {
        setShowDeleteModal(false);
        setDeleting(false);
        navigation.goBack();
      }
    } catch (err) {
      setShowDeleteModal(false);
      setDeleting(false);
      setErrorMessage("Failed to delete receipt.");
      setShowErrorModal(true);
    }
  };

  // Toggle items expanded
  const toggleItems = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItemsExpanded(!itemsExpanded);
  };

  // Format date nicely
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // Category styling (dynamic)
  const catColor = getCategoryColor(category, categories);
  const catIcon = getCategoryIcon(category, categories);

  // Items to display (collapsed = first 3, expanded = all)
  const COLLAPSED_ITEM_COUNT = 3;
  const displayedItems = itemsExpanded ? items : items.slice(0, COLLAPSED_ITEM_COUNT);
  const hasMoreItems = items.length > COLLAPSED_ITEM_COUNT;

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
            onPress={() => {
              if (editing) {
                setShowDiscardModal(true);
              } else {
                navigation.goBack();
              }
            }}
            activeOpacity={0.7}
          >
            <Icon name="arrow-left" size={20} color={DS.textPrimary} />
          </TouchableOpacity>

          <View style={styles.topBarActions}>
            {!editing ? (
              <TouchableOpacity
                style={styles.topBarBtn}
                onPress={() => setEditing(true)}
                activeOpacity={0.7}
              >
                <Icon name="edit-2" size={18} color={DS.brandBlue} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.topBarBtn}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Icon name="x" size={20} color={DS.negative} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.topBarBtn, { marginLeft: 8 }]}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Icon name="trash-2" size={18} color={DS.negative} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* ── Hero Section ── */}
          <Animated.View
            style={[
              styles.heroCard,
              { opacity: heroOpacity, transform: [{ scale: heroScale }] },
            ]}
          >
            <View style={styles.heroTop}>
              <TouchableOpacity
                style={styles.thumbnailBox}
                onPress={() => imageUrl && setShowFullImage(true)}
                activeOpacity={imageUrl ? 0.7 : 1}
              >
                {loadingImage ? (
                  <ActivityIndicator size="small" color={DS.textSecondary} />
                ) : imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.thumbnailImage} resizeMode="cover" />
                ) : (
                  <Ionicons name="receipt-outline" size={28} color={DS.textSecondary} />
                )}
              </TouchableOpacity>

              <View style={styles.heroInfo}>
                {editing ? (
                  <TextInput
                    style={styles.heroStoreInput}
                    value={storeName}
                    onChangeText={setStoreName}
                    selectTextOnFocus
                  />
                ) : (
                  <Text style={styles.heroStoreName} numberOfLines={2}>
                    {storeName || "Unknown Store"}
                  </Text>
                )}

                <View style={styles.heroMetaRow}>
                  <View style={[styles.categoryPill, { backgroundColor: catColor + "18" }]}>
                    <Ionicons name={catIcon} size={12} color={catColor} />
                    <Text style={[styles.categoryPillText, { color: catColor }]}>
                      {category || "Other"}
                    </Text>
                  </View>
                  <Text style={styles.heroDate}>{formatDate(date)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroTotalRow}>
              <Text style={styles.heroTotalLabel}>Total</Text>
              <Text style={styles.heroTotalAmount}>
                ${parseFloat(totalAmount || 0).toFixed(2)}
              </Text>
            </View>

            <View style={styles.heroChips}>
              {paymentMethod && paymentMethod !== "Unknown" && (
                <View style={styles.chip}>
                  <Ionicons name="card-outline" size={13} color={DS.textSecondary} />
                  <Text style={styles.chipText}>{paymentMethod}</Text>
                </View>
              )}
              <View style={styles.chip}>
                <Ionicons
                  name={receipt.status === "completed" ? "checkmark-circle-outline" : "time-outline"}
                  size={13}
                  color={receipt.status === "completed" ? DS.positive : DS.accentGold}
                />
                <Text
                  style={[
                    styles.chipText,
                    { color: receipt.status === "completed" ? DS.positive : DS.accentGold },
                  ]}
                >
                  {receipt.status || "Unknown"}
                </Text>
              </View>
              {imageUrl && (
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() => setShowFullImage(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="image-outline" size={13} color={DS.brandBlue} />
                  <Text style={[styles.chipText, { color: DS.brandBlue }]}>View Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          {/* ── Details Card (editing mode) ── */}
          {editing && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Details</Text>
              <Field label="Date" value={date} onChangeText={setDate} editing icon="calendar-outline" />
              <View style={styles.fieldDivider} />

              {/* Category Picker — dynamic chips with inline + modal */}
              {categories.length > 0 ? (
                <CategoryPicker
                  categories={categories}
                  selected={category}
                  onSelect={setCategory}
                  onAddNew={() => setAddCatModalVisible(true)}
                />
              ) : (
                <Field label="Category" value={category} onChangeText={setCategory} editing icon="pricetag-outline" />
              )}

              <View style={styles.fieldDivider} />
              <Field label="Payment" value={paymentMethod} onChangeText={setPaymentMethod} editing icon="card-outline" />
            </View>
          )}

          {/* ── Items Section ── */}
          {items.length > 0 && (
            <View style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionTitleRow}
                onPress={toggleItems}
                activeOpacity={0.7}
              >
                <View style={styles.sectionTitleLeft}>
                  <Text style={styles.sectionTitle}>Items</Text>
                  <View style={styles.itemCountBadge}>
                    <Text style={styles.itemCountText}>{items.length}</Text>
                  </View>
                </View>
                <Icon
                  name={itemsExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={DS.textSecondary}
                />
              </TouchableOpacity>

              {displayedItems.map((item, index) => (
                <View key={index}>
                  <View style={styles.itemRow}>
                    {editing ? (
                      <>
                        <TextInput
                          style={[styles.fieldInput, { flex: 1, textAlign: "left", marginRight: 12 }]}
                          value={item.name}
                          onChangeText={(text) => updateItem(index, "name", text)}
                          selectTextOnFocus
                        />
                        <TextInput
                          style={[styles.fieldInput, { width: 80, textAlign: "right" }]}
                          value={item.price}
                          onChangeText={(text) => updateItem(index, "price", text)}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                        />
                      </>
                    ) : (
                      <>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.name || "Item"}
                          {item.quantity > 1 ? `  ×${item.quantity}` : ""}
                        </Text>
                        <Text style={styles.itemPrice}>${parseFloat(item.price || 0).toFixed(2)}</Text>
                      </>
                    )}
                  </View>
                  {index < displayedItems.length - 1 && <View style={styles.fieldDivider} />}
                </View>
              ))}

              {hasMoreItems && (
                <TouchableOpacity
                  style={styles.showMoreBtn}
                  onPress={toggleItems}
                  activeOpacity={0.7}
                >
                  <Text style={styles.showMoreText}>
                    {itemsExpanded
                      ? "Show less"
                      : `Show ${items.length - COLLAPSED_ITEM_COUNT} more items`}
                  </Text>
                  <Icon
                    name={itemsExpanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={DS.brandBlue}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Price Breakdown ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Price Breakdown</Text>
            <Field label="Subtotal" value={subtotal} onChangeText={setSubtotal} keyboardType="decimal-pad" editing={editing} icon="receipt-outline" />
            <View style={styles.fieldDivider} />
            <Field label="Discount" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" editing={editing} icon="pricetag-outline" />
            <View style={styles.fieldDivider} />
            <Field label="Tax" value={tax} onChangeText={setTax} keyboardType="decimal-pad" editing={editing} icon="calculator-outline" />
            <View style={styles.totalDivider} />
            <View style={styles.fieldRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              {editing ? (
                <TextInput
                  style={[styles.fieldInput, styles.totalInput]}
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
              ) : (
                <Text style={styles.totalValue}>
                  ${parseFloat(totalAmount || 0).toFixed(2)}
                </Text>
              )}
            </View>
          </View>

          {/* ── Notes ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {editing ? (
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add a note about this receipt..."
                placeholderTextColor={DS.textSecondary}
                multiline
              />
            ) : (
              <Text style={notes ? styles.notesText : styles.notesPlaceholder}>
                {notes || "No notes yet. Tap edit to add one."}
              </Text>
            )}
          </View>

          {/* ── OCR Button ── */}
          {receipt.raw_text ? (
            <TouchableOpacity
              style={styles.ocrButton}
              onPress={() => setShowOCR(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text-outline" size={18} color={DS.textSecondary} />
              <Text style={styles.ocrButtonText}>View Raw OCR Text</Text>
              <Icon name="chevron-right" size={16} color={DS.textSecondary} />
            </TouchableOpacity>
          ) : null}

          {/* ── Scanned On ── */}
          <View style={styles.scannedOnCard}>
            <Ionicons name="time-outline" size={14} color={DS.textSecondary} />
            <Text style={styles.scannedOnText}>
              Scanned{" "}
              {receipt.created_at
                ? new Date(receipt.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Unknown"}
            </Text>
          </View>
        </ScrollView>

        {/* ── Save Button (edit mode only) ── */}
        {editing && (
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
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── Add Category Modal (inline — no navigation) ── */}
      <AddCategoryModal
        visible={addCatModalVisible}
        onClose={() => setAddCatModalVisible(false)}
        existingNames={categories.map((c) => c.name)}
        onCategoryAdded={handleCategoryAdded}
      />

      {/* ── Full Image Modal ── */}
      <Modal visible={showFullImage} animationType="fade" transparent>
        <View style={styles.fullImageOverlay}>
          <TouchableOpacity
            style={styles.fullImageClose}
            onPress={() => setShowFullImage(false)}
          >
            <View style={styles.fullImageCloseCircle}>
              <Icon name="x" size={22} color="#fff" />
            </View>
          </TouchableOpacity>
          {imageUrl && (
            <ZoomableImage uri={imageUrl} />
          )}
        </View>
      </Modal>

      {/* ── OCR Modal ── */}
      <Modal visible={showOCR} animationType="slide" transparent>
        <View style={styles.ocrModalOverlay}>
          <View style={styles.ocrModalContent}>
            <View style={styles.ocrModalHeader}>
              <Text style={styles.ocrModalTitle}>Raw OCR Text</Text>
              <TouchableOpacity onPress={() => setShowOCR(false)} activeOpacity={0.7}>
                <View style={styles.topBarBtn}>
                  <Icon name="x" size={20} color={DS.textPrimary} />
                </View>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.ocrModalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.ocrText}>{receipt.raw_text || "No OCR text available"}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal visible={showDeleteModal} animationType="fade" transparent>
        <View style={styles.customModalOverlay}>
          <View style={styles.customModalCard}>
            <View style={styles.deleteIconCircle}>
              <Icon name="trash-2" size={28} color={DS.negative} />
            </View>
            <Text style={styles.customModalTitle}>Delete Receipt?</Text>
            <Text style={styles.customModalMessage}>
              This will permanently remove this receipt and all its data. This action can't be undone.
            </Text>
            <View style={styles.customModalButtons}>
              <TouchableOpacity
                style={styles.customModalBtnSecondary}
                onPress={() => setShowDeleteModal(false)}
                activeOpacity={0.7}
                disabled={deleting}
              >
                <Text style={styles.customModalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.customModalBtnDanger, deleting && { opacity: 0.5 }]}
                onPress={confirmDelete}
                activeOpacity={0.7}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={DS.textInverse} />
                ) : (
                  <>
                    <Icon name="trash-2" size={16} color={DS.textInverse} style={{ marginRight: 6 }} />
                    <Text style={styles.customModalBtnDangerText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Success Modal ── */}
      <Modal visible={showSuccessModal} animationType="none" transparent>
        <Animated.View style={[styles.customModalOverlay, { opacity: successOpacity }]}>
          <Animated.View style={[styles.successModalCard, { transform: [{ scale: successScale }] }]}>
            <Animated.View style={[styles.successIconCircle, { transform: [{ scale: checkScale }] }]}>
              <Icon name="check" size={32} color={DS.textInverse} />
            </Animated.View>
            <Text style={styles.successTitle}>Saved!</Text>
            <Text style={styles.successMessage}>Receipt updated successfully</Text>
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

      {/* ── Discard Changes Modal ── */}
      <Modal visible={showDiscardModal} animationType="fade" transparent>
        <View style={styles.customModalOverlay}>
          <View style={styles.customModalCard}>
            <View style={styles.discardIconCircle}>
              <Icon name="alert-circle" size={28} color={DS.accentGold} />
            </View>
            <Text style={styles.customModalTitle}>Unsaved Changes</Text>
            <Text style={styles.customModalMessage}>
              You have unsaved changes. Are you sure you want to discard them?
            </Text>
            <View style={styles.customModalButtons}>
              <TouchableOpacity
                style={styles.customModalBtnSecondary}
                onPress={() => setShowDiscardModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.customModalBtnSecondaryText}>Keep Editing</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.customModalBtnDanger}
                onPress={() => {
                  setShowDiscardModal(false);
                  setEditing(false);
                  navigation.goBack();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.customModalBtnDangerText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },

  topBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: DS.pagePad,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 6 : 8,
    paddingBottom: 8,
  },
  topBarBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: DS.bgSurface,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  topBarActions: { flexDirection: "row", alignItems: "center" },

  scrollContent: { paddingHorizontal: DS.pagePad, paddingBottom: 100 },

  heroCard: {
    backgroundColor: DS.bgSurface, borderRadius: DS.cardRadius, padding: 20, marginTop: 8,
    borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 3 },
    }),
  },
  heroTop: { flexDirection: "row", alignItems: "center" },
  thumbnailBox: {
    width: 64, height: 64, borderRadius: 14, backgroundColor: DS.bgSurface2,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    borderWidth: 1, borderColor: DS.border,
  },
  thumbnailImage: { width: "100%", height: "100%" },
  heroInfo: { flex: 1, marginLeft: 14 },
  heroStoreName: { fontSize: 22, fontWeight: "700", color: DS.textPrimary, letterSpacing: -0.3 },
  heroStoreInput: {
    fontSize: 20, fontWeight: "700", color: DS.textPrimary,
    borderBottomWidth: 1, borderBottomColor: DS.brandBlue, paddingBottom: 2, paddingVertical: 0,
  },
  heroMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 10 },
  categoryPill: { flexDirection: "row", alignItems: "center", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, gap: 4 },
  categoryPillText: { fontSize: 12, fontWeight: "600" },
  heroDate: { fontSize: 13, fontWeight: "500", color: DS.textSecondary },
  heroDivider: { height: 1, backgroundColor: DS.border, marginVertical: 16 },
  heroTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  heroTotalLabel: { fontSize: 14, fontWeight: "500", color: DS.textSecondary },
  heroTotalAmount: { fontSize: 32, fontWeight: "800", color: DS.accentGold, letterSpacing: -0.5 },
  heroChips: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", backgroundColor: DS.bgSurface2, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, gap: 5 },
  chipText: { fontSize: 12, fontWeight: "500", color: DS.textSecondary },

  sectionCard: {
    backgroundColor: DS.bgSurface, borderRadius: DS.cardRadius, padding: 20, marginTop: 14,
    borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.8, shadowRadius: 12 },
      android: { elevation: 1 },
    }),
  },
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  sectionTitleLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: DS.textPrimary, marginBottom: 8 },
  itemCountBadge: { backgroundColor: DS.brandNavy, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8 },
  itemCountText: { fontSize: 11, fontWeight: "700", color: DS.textInverse },

  fieldRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  fieldLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  fieldLabel: { fontSize: 14, fontWeight: "500", color: DS.textSecondary },
  fieldValue: { fontSize: 14, fontWeight: "600", color: DS.textPrimary, textAlign: "right" },
  fieldInput: {
    fontSize: 14, fontWeight: "600", color: DS.textPrimary, textAlign: "right",
    paddingVertical: 4, paddingHorizontal: 8, backgroundColor: DS.bgSurface2,
    borderRadius: 8, borderWidth: 1, borderColor: DS.border,
  },
  fieldDivider: { height: 1, backgroundColor: DS.border },

  categoryPickerContainer: { paddingVertical: 12 },
  categoryChipsScroll: { marginTop: 10 },
  categoryChipsRow: { gap: 8, paddingRight: 4 },
  categoryChip: {
    flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: 999, borderWidth: 1.5, gap: 6,
  },
  categoryChipText: { fontSize: 13, fontWeight: "600" },
  addCategoryChip: {
    flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: 999, borderWidth: 1.5, borderColor: DS.brandBlue, borderStyle: "dashed",
    backgroundColor: DS.brandBlue + "08", gap: 4,
  },
  addCategoryChipText: { fontSize: 13, fontWeight: "600", color: DS.brandBlue },

  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  itemName: { fontSize: 14, fontWeight: "500", color: DS.textPrimary, flex: 1, marginRight: 12 },
  itemPrice: { fontSize: 14, fontWeight: "600", color: DS.textPrimary },
  showMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingTop: 12, gap: 4, borderTopWidth: 1, borderTopColor: DS.border, marginTop: 4,
  },
  showMoreText: { fontSize: 13, fontWeight: "600", color: DS.brandBlue },

  totalDivider: { height: 2, backgroundColor: DS.brandNavy, marginTop: 4, borderRadius: 1 },
  totalLabel: { fontSize: 15, fontWeight: "800", color: DS.textPrimary, letterSpacing: 0.5 },
  totalValue: { fontSize: 18, fontWeight: "800", color: DS.accentGold },
  totalInput: { fontSize: 16, fontWeight: "800", color: DS.accentGold },

  notesInput: {
    fontSize: 14, color: DS.textPrimary, minHeight: 80, textAlignVertical: "top",
    paddingVertical: 8, paddingHorizontal: 12, backgroundColor: DS.bgSurface2,
    borderRadius: 12, borderWidth: 1, borderColor: DS.border,
  },
  notesText: { fontSize: 14, color: DS.textPrimary, lineHeight: 20 },
  notesPlaceholder: { fontSize: 14, color: DS.textSecondary, fontStyle: "italic" },

  ocrButton: {
    flexDirection: "row", alignItems: "center", backgroundColor: DS.bgSurface,
    borderRadius: 14, padding: 16, marginTop: 14, borderWidth: 1, borderColor: DS.border, gap: 10,
  },
  ocrButtonText: { fontSize: 14, fontWeight: "500", color: DS.textSecondary, flex: 1 },

  scannedOnCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 16, marginTop: 14, gap: 6,
  },
  scannedOnText: { fontSize: 12, fontWeight: "400", color: DS.textSecondary },

  saveContainer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: Platform.OS === "ios" ? 30 : 16,
    backgroundColor: DS.bgPage, borderTopWidth: 1, borderTopColor: DS.border,
  },
  saveBtn: {
    backgroundColor: DS.brandNavy, borderRadius: 14, paddingVertical: 16,
    alignItems: "center", justifyContent: "center", flexDirection: "row",
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: DS.textInverse, fontSize: 16, fontWeight: "700" },

  fullImageOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
  fullImageClose: { position: "absolute", top: Platform.OS === "ios" ? 54 : 40, right: 20, zIndex: 10 },
  fullImageCloseCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  fullImage: { width: "92%", height: "78%" },

  ocrModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  ocrModalContent: { backgroundColor: DS.bgSurface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%", padding: 20 },
  ocrModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  ocrModalTitle: { fontSize: 18, fontWeight: "700", color: DS.textPrimary },
  ocrModalScroll: { maxHeight: "90%" },
  ocrText: {
    fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: DS.textPrimary, lineHeight: 20, backgroundColor: DS.bgSurface2, padding: 16, borderRadius: 12,
  },

  customModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  customModalCard: {
    backgroundColor: DS.bgSurface, borderRadius: 24, paddingVertical: 28, paddingHorizontal: 24,
    width: "100%", alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "rgba(0,0,0,0.25)", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 30 },
      android: { elevation: 12 },
    }),
  },
  deleteIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#C8402A18", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  errorIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#C8402A18", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  discardIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: DS.accentGoldSub, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  customModalTitle: { fontSize: 20, fontWeight: "700", color: DS.textPrimary, textAlign: "center", marginBottom: 8 },
  customModalMessage: { fontSize: 14, fontWeight: "400", color: DS.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  customModalButtons: { flexDirection: "row", gap: 10, width: "100%" },
  customModalBtnSecondary: {
    flex: 1, height: 48, borderRadius: 14, backgroundColor: DS.bgSurface2,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: DS.border,
  },
  customModalBtnSecondaryText: { fontSize: 15, fontWeight: "600", color: DS.textPrimary },
  customModalBtnDanger: { flex: 1, height: 48, borderRadius: 14, backgroundColor: DS.negative, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  customModalBtnDangerText: { fontSize: 15, fontWeight: "600", color: DS.textInverse },
  customModalBtnPrimary: { width: "100%", height: 48, borderRadius: 14, backgroundColor: DS.brandNavy, alignItems: "center", justifyContent: "center" },
  customModalBtnPrimaryText: { fontSize: 15, fontWeight: "600", color: DS.textInverse },

  successModalCard: {
    backgroundColor: DS.bgSurface, borderRadius: 24, paddingVertical: 36, paddingHorizontal: 24,
    width: "80%", alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "rgba(0,0,0,0.25)", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 30 },
      android: { elevation: 12 },
    }),
  },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: DS.positive, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: "700", color: DS.textPrimary, marginBottom: 4 },
  successMessage: { fontSize: 14, fontWeight: "400", color: DS.textSecondary },
});