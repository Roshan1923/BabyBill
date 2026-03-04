/* eslint-disable react-native/no-inline-styles */
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, ScrollView, Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { supabase } from "../config/supabase";

const DS = {
  bgPage: "#FAF8F4", bgSurface: "#FFFEFB", bgSurface2: "#F5F2EC",
  brandNavy: "#1A3A6B", textPrimary: "#1C1610", textSecondary: "#8A7E72",
  textInverse: "#FFFEFB", negative: "#C8402A", border: "#EDE8E0",
  shadow: "rgba(26,58,107,0.10)", pagePad: 20,
};

const ICON_OPTIONS = [
  "restaurant-outline", "document-text-outline", "car-outline", "bag-outline",
  "medical-outline", "receipt-outline", "home-outline", "airplane-outline",
  "school-outline", "fitness-outline", "game-controller-outline", "musical-notes-outline",
  "paw-outline", "gift-outline", "construct-outline", "wifi-outline",
  "call-outline", "shirt-outline", "cafe-outline", "beer-outline",
  "bus-outline", "barbell-outline", "book-outline", "film-outline",
];

const COLOR_OPTIONS = [
  "#E8A020", "#2563C8", "#C8402A", "#7C3AED", "#2A8C5C",
  "#8A7E72", "#E05A9C", "#0EA5E9", "#F97316", "#10B981",
  "#6366F1", "#EC4899", "#14B8A6", "#A855F7", "#EF4444",
  "#84CC16", "#06B6D4", "#F59E0B", "#8B5CF6", "#22C55E",
];

/**
 * Reusable Add Category Modal — used by CategoryScreen, DetailScreen, ReviewReceiptScreen.
 *
 * Props:
 *  - visible: boolean
 *  - onClose: () => void
 *  - existingNames: string[] — for duplicate checking
 *  - onCategoryAdded: (newCat: {name, icon, color}) => void — called after successful Supabase insert
 */
export default function AddCategoryModal({ visible, onClose, existingNames = [], onCategoryAdded }) {
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("pricetag-outline");
  const [selectedColor, setSelectedColor] = useState("#E8A020");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName("");
    setSelectedIcon("pricetag-outline");
    setSelectedColor("#E8A020");
    setError("");
    setSaving(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Category name is required"); return; }
    if (trimmed.length > 20) { setError("Name must be 20 characters or less"); return; }
    if (existingNames.map((n) => n.toLowerCase()).includes(trimmed.toLowerCase())) {
      setError("Category already exists"); return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Not authenticated"); setSaving(false); return; }

      const { error: insertError } = await supabase.from("user_categories").insert({
        user_id: user.id,
        name: trimmed,
        icon: selectedIcon,
        color: selectedColor,
        is_default: false,
      });

      if (insertError) {
        setError("Failed to add category");
        setSaving(false);
        return;
      }

      const newCat = { name: trimmed, icon: selectedIcon, color: selectedColor };
      resetForm();
      onClose();
      if (onCategoryAdded) onCategoryAdded(newCat);
    } catch (err) {
      setError("Something went wrong");
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Category</Text>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.6}>
              <Ionicons name="close" size={22} color={DS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>NAME</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Groceries, Rent, Subscriptions..."
                placeholderTextColor={DS.textSecondary}
                value={name}
                onChangeText={(text) => { setName(text); setError(""); }}
                maxLength={20}
                autoFocus
              />
            </View>
            {error !== "" && <Text style={styles.errorText}>{error}</Text>}

            <Text style={styles.inputLabel}>ICON</Text>
            <View style={styles.iconGrid}>
              {ICON_OPTIONS.map((iconName) => {
                const active = selectedIcon === iconName;
                return (
                  <TouchableOpacity
                    key={iconName}
                    style={[styles.iconOption, active && { backgroundColor: selectedColor + "20", borderColor: selectedColor }]}
                    onPress={() => setSelectedIcon(iconName)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={iconName} size={22} color={active ? selectedColor : DS.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>COLOR</Text>
            <View style={styles.colorGrid}>
              {COLOR_OPTIONS.map((color) => {
                const active = selectedColor === color;
                return (
                  <TouchableOpacity
                    key={color}
                    style={[styles.colorOption, { backgroundColor: color }, active && styles.colorOptionActive]}
                    onPress={() => setSelectedColor(color)}
                    activeOpacity={0.7}
                  >
                    {active && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>PREVIEW</Text>
            <View style={styles.previewRow}>
              <View style={[styles.previewIconBox, { backgroundColor: selectedColor + "18" }]}>
                <Ionicons name={selectedIcon} size={20} color={selectedColor} />
              </View>
              <Text style={styles.previewName}>{name || "Category Name"}</Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.addButton, (!name.trim() || saving) && styles.addButtonDisabled]}
            onPress={handleAdd}
            activeOpacity={0.8}
            disabled={!name.trim() || saving}
          >
            <Text style={styles.addButtonText}>{saving ? "Adding..." : "Add Category"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: DS.bgSurface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: DS.pagePad, paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24, maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: DS.textPrimary },
  inputLabel: {
    fontSize: 12, fontWeight: "600", color: DS.textSecondary,
    letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
  },
  inputContainer: {
    backgroundColor: DS.bgSurface2, borderRadius: 12, paddingHorizontal: 14,
    height: 48, justifyContent: "center", borderWidth: 1, borderColor: DS.border,
  },
  textInput: { fontSize: 15, fontWeight: "500", color: DS.textPrimary },
  errorText: { fontSize: 12, color: DS.negative, marginTop: 6, fontWeight: "500" },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  iconOption: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: DS.bgSurface2,
    alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "transparent",
  },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  colorOption: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  colorOptionActive: {
    borderWidth: 3, borderColor: DS.bgSurface,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  previewRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: DS.bgSurface2,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 20,
  },
  previewIconBox: {
    width: 36, height: 36, borderRadius: 10, alignItems: "center",
    justifyContent: "center", marginRight: 12,
  },
  previewName: { fontSize: 15, fontWeight: "600", color: DS.textPrimary },
  addButton: {
    backgroundColor: DS.brandNavy, borderRadius: 14, height: 52,
    alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  addButtonDisabled: { opacity: 0.4 },
  addButtonText: { fontSize: 16, fontWeight: "700", color: DS.textInverse },
});