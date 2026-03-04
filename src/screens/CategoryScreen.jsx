import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Platform, StatusBar, SafeAreaView, Modal, Alert,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../config/supabase";
import AddCategoryModal from "../components/AddCategoryModal";

const DS = {
  bgPage: "#FAF8F4", bgSurface: "#FFFEFB", bgSurface2: "#F5F2EC",
  brandNavy: "#1A3A6B", brandBlue: "#2563C8", accentGold: "#E8A020",
  accentGoldSub: "#FEF3DC", textPrimary: "#1C1610", textSecondary: "#8A7E72",
  textInverse: "#FFFEFB", positive: "#2A8C5C", negative: "#C8402A",
  border: "#EDE8E0", shadow: "rgba(26,58,107,0.10)",
  pagePad: 20, cardRadius: 16,
};

function CategoryRow({ item, onDelete }) {
  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryLeft}>
        <View style={[styles.categoryIconBox, { backgroundColor: item.color + "18" }]}>
          <Ionicons name={item.icon} size={20} color={item.color} />
        </View>
        <View style={styles.categoryTextBlock}>
          <Text style={styles.categoryName}>{item.name}</Text>
          {item.is_default && <Text style={styles.categoryBadge}>Default</Text>}
        </View>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item)} activeOpacity={0.6}>
        <Ionicons name="trash-outline" size={18} color={DS.negative} />
      </TouchableOpacity>
    </View>
  );
}

export default function CategoryScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("user_categories").select("*").eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) { console.error("Error fetching categories:", error); return; }
      setCategories(data || []);
    } catch (err) { console.error("Fetch error:", err); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { fetchCategories(); }, []));

  const handleCategoryAdded = () => {
    fetchCategories();
  };

  const handleDelete = (item) => {
    setCategoryToDelete(item);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      setDeleting(true);
      const { error } = await supabase
        .from("user_categories").delete().eq("id", categoryToDelete.id);
      if (error) {
        Alert.alert("Error", "Failed to delete category.");
        return;
      }
      setCategories((prev) => prev.filter((c) => c.id !== categoryToDelete.id));
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleting(false);
      setDeleteModalVisible(false);
      setCategoryToDelete(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Icon name="arrow-left" size={22} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Categories</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text style={styles.subtitle}>
        Manage your receipt categories. Add custom ones or remove any you don't need.
      </Text>

      <TouchableOpacity style={styles.addRow} onPress={() => setModalVisible(true)} activeOpacity={0.7}>
        <View style={styles.addIconBox}>
          <Ionicons name="add" size={22} color={DS.brandNavy} />
        </View>
        <Text style={styles.addRowText}>Add New Category</Text>
        <Icon name="chevron-right" size={16} color={DS.textSecondary} />
      </TouchableOpacity>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DS.brandNavy} />
        </View>
      ) : (
        <FlatList data={categories} keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CategoryRow item={item} onDelete={handleDelete} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={40} color={DS.textSecondary} />
              <Text style={styles.emptyTitle}>No categories</Text>
              <Text style={styles.emptySubtitle}>Add a category to get started</Text>
            </View>
          }
        />
      )}

      {/* ── Add Category Modal (shared component) ── */}
      <AddCategoryModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        existingNames={categories.map((c) => c.name)}
        onCategoryAdded={handleCategoryAdded}
      />

      {/* ── Delete Confirmation Modal ── */}
      <Modal visible={deleteModalVisible} transparent animationType="fade"
        onRequestClose={() => { setDeleteModalVisible(false); setCategoryToDelete(null); }}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteCard}>
            <View style={styles.deleteIconCircle}>
              <Ionicons name="trash-outline" size={24} color={DS.negative} />
            </View>
            <Text style={styles.deleteTitle}>Delete Category</Text>
            <Text style={styles.deleteMessage}>
              Are you sure you want to delete "{categoryToDelete?.name}"? Receipts with this category will be reassigned to "Other".
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity style={styles.deleteBtnSecondary}
                onPress={() => { setDeleteModalVisible(false); setCategoryToDelete(null); }}
                activeOpacity={0.7}>
                <Text style={styles.deleteBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtnDanger}
                onPress={confirmDelete} activeOpacity={0.7}>
                {deleting ? (
                  <ActivityIndicator size="small" color={DS.textInverse} />
                ) : (
                  <Text style={styles.deleteBtnDangerText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: DS.pagePad,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 10 : 12,
    paddingBottom: 8,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: DS.textPrimary },
  subtitle: {
    fontSize: 13, fontWeight: "400", color: DS.textSecondary,
    paddingHorizontal: DS.pagePad, marginBottom: 16, lineHeight: 18,
  },
  addRow: {
    flexDirection: "row", alignItems: "center", marginHorizontal: DS.pagePad,
    marginBottom: 12, backgroundColor: DS.bgSurface, borderRadius: DS.cardRadius,
    paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: DS.brandNavy + "30", borderStyle: "dashed",
  },
  addIconBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: DS.brandNavy + "12",
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  addRowText: { flex: 1, fontSize: 15, fontWeight: "600", color: DS.brandNavy },
  categoryRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: DS.pagePad, marginVertical: 3, backgroundColor: DS.bgSurface,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.6, shadowRadius: 6 },
      android: { elevation: 1 },
    }),
  },
  categoryLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  categoryIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  categoryTextBlock: { marginLeft: 12, flex: 1 },
  categoryName: { fontSize: 15, fontWeight: "600", color: DS.textPrimary },
  categoryBadge: { fontSize: 11, fontWeight: "500", color: DS.textSecondary, marginTop: 2 },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center",
    justifyContent: "center", backgroundColor: DS.negative + "10",
  },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingBottom: 40 },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: DS.textPrimary },
  emptySubtitle: { fontSize: 13, color: DS.textSecondary },
  deleteOverlay: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 32,
  },
  deleteCard: {
    width: "100%", borderRadius: 24, padding: 28,
    alignItems: "center", backgroundColor: DS.bgSurface,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 28 },
      android: { elevation: 8 },
    }),
  },
  deleteIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16, backgroundColor: DS.negative + "14",
  },
  deleteTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8, color: DS.textPrimary },
  deleteMessage: {
    fontSize: 14, fontWeight: "400", textAlign: "center",
    lineHeight: 20, marginBottom: 24, color: DS.textSecondary,
  },
  deleteActions: { flexDirection: "row", gap: 12, width: "100%" },
  deleteBtnSecondary: {
    flex: 1, height: 48, borderRadius: 999,
    alignItems: "center", justifyContent: "center", backgroundColor: DS.bgSurface2,
  },
  deleteBtnSecondaryText: { fontSize: 15, fontWeight: "600", color: DS.textPrimary },
  deleteBtnDanger: {
    flex: 1, height: 48, borderRadius: 999,
    alignItems: "center", justifyContent: "center", backgroundColor: DS.negative,
  },
  deleteBtnDangerText: { fontSize: 15, fontWeight: "600", color: DS.textInverse },
});