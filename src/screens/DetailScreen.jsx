/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  StatusBar, Alert, ScrollView, Image, ActivityIndicator, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../config/supabase';

// Field component — MUST be outside DetailScreen to avoid hooks order issues
const Field = ({ label, value, onChangeText, keyboardType = 'default', valueStyle = {}, editing = false }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    {editing ? (
      <TextInput
        style={styles.editInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        selectTextOnFocus
      />
    ) : (
      <Text style={[styles.value, valueStyle]}>{value || '—'}</Text>
    )}
  </View>
);

export default function DetailScreen({ route, navigation }) {
  const { receipt } = route.params;
  const [imageUrl, setImageUrl] = useState(null);
  const [loadingImage, setLoadingImage] = useState(true);
  const [showOCR, setShowOCR] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  // Editable fields
  const [storeName, setStoreName] = useState(receipt.store_name || '');
  const [date, setDate] = useState(receipt.date || '');
  const [category, setCategory] = useState(receipt.category || '');
  const [paymentMethod, setPaymentMethod] = useState(receipt.payment_method || '');
  const [subtotal, setSubtotal] = useState(receipt.subtotal?.toString() || '0.00');
  const [tax, setTax] = useState(receipt.tax?.toString() || '0.00');
  const [discount, setDiscount] = useState(receipt.discount?.toString() || '0.00');
  const [totalAmount, setTotalAmount] = useState(receipt.total_amount?.toString() || '0.00');
  const [items, setItems] = useState(
    (receipt.items || []).map(item => ({
      name: item.name || '',
      price: item.price?.toString() || '0.00',
      quantity: item.quantity || 1,
    }))
  );
  const [notes, setNotes] = useState(receipt.notes || '');

  // Update an item field
  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Cancel editing and revert changes
  const handleCancel = () => {
    setStoreName(receipt.store_name || '');
    setDate(receipt.date || '');
    setCategory(receipt.category || '');
    setPaymentMethod(receipt.payment_method || '');
    setSubtotal(receipt.subtotal?.toString() || '0.00');
    setTax(receipt.tax?.toString() || '0.00');
    setDiscount(receipt.discount?.toString() || '0.00');
    setTotalAmount(receipt.total_amount?.toString() || '0.00');
    setItems(
      (receipt.items || []).map(item => ({
        name: item.name || '',
        price: item.price?.toString() || '0.00',
        quantity: item.quantity || 1,
      }))
    );
    setNotes(receipt.notes || '');
    setEditing(false);
  };

  // Save changes to Supabase
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('receipts')
        .update({
          store_name: storeName,
          date: date,
          category: category,
          payment_method: paymentMethod,
          subtotal: parseFloat(subtotal) || 0,
          tax: parseFloat(tax) || 0,
          discount: parseFloat(discount) || 0,
          total_amount: parseFloat(totalAmount) || 0,
          items: items.map(item => ({
            name: item.name,
            price: parseFloat(item.price) || 0,
            quantity: item.quantity,
          })),
          notes: notes,
        })
        .eq('id', receipt.id);

      if (error) {
        Alert.alert('Error', 'Failed to save changes');
        console.log('Save error:', error);
      } else {
        setEditing(false);
        Alert.alert('Saved', 'Receipt updated successfully');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to save changes');
      console.log('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Load signed URL for the receipt image
  useEffect(() => {
    const loadImage = async () => {
      if (receipt.image_url) {
        try {
          const filePath = receipt.image_url.replace('receipt-images/', '');
          const { data, error } = await supabase.storage
            .from('receipt-images')
            .createSignedUrl(filePath, 3600);

          if (data?.signedUrl) {
            setImageUrl(data.signedUrl);
          }
        } catch (err) {
          console.log('Image load error:', err);
        }
      }
      setLoadingImage(false);
    };
    loadImage();
  }, [receipt.image_url]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Receipt',
      'Are you sure you want to delete this receipt?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('receipts')
                .delete()
                .eq('id', receipt.id);
              if (error) {
                Alert.alert('Error', 'Failed to delete receipt');
              } else {
                navigation.goBack();
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to delete receipt');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#030712" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            if (editing) {
              Alert.alert('Unsaved Changes', 'You have unsaved changes. Discard them?', [
                { text: 'Keep Editing', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => { setEditing(false); navigation.goBack(); } },
              ]);
            } else {
              navigation.goBack();
            }
          }}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete}>
            <Text style={styles.deleteBtn}>Delete</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

          {/* Receipt Image */}
          <TouchableOpacity
            style={styles.imageBox}
            onPress={() => imageUrl && setShowFullImage(true)}
            activeOpacity={imageUrl ? 0.7 : 1}
          >
            {loadingImage ? (
              <ActivityIndicator size="large" color="#3b82f6" />
            ) : imageUrl ? (
              <>
                <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
                <View style={styles.tapHint}>
                  <Text style={styles.tapHintText}>Tap to view full size</Text>
                </View>
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={{ fontSize: 50 }}>🧾</Text>
                <Text style={{ color: '#6b7280', marginTop: 8 }}>Receipt image will show here</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Store Name + Edit Button Row */}
          <View style={styles.storeRow}>
            {editing ? (
              <TextInput
                style={styles.storeNameInput}
                value={storeName}
                onChangeText={setStoreName}
                selectTextOnFocus
              />
            ) : (
              <Text style={styles.storeName}>{storeName || 'Unknown Store'}</Text>
            )}
            {!editing ? (
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Info Card */}
          <View style={styles.card}>
            <Field label="Date" value={date} onChangeText={setDate} editing={editing} />
            <View style={styles.divider} />
            <Field label="Category" value={category} onChangeText={setCategory} editing={editing} />
            <View style={styles.divider} />
            <Field label="Payment" value={paymentMethod} onChangeText={setPaymentMethod} editing={editing} />
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Status</Text>
              <Text style={[styles.value, { color: receipt.status === 'completed' ? '#22c55e' : '#f59e0b' }]}>
                {receipt.status || 'Unknown'}
              </Text>
            </View>
          </View>

          {/* Items Section */}
          {items.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>Items ({items.length})</Text>
              <View style={styles.card}>
                {items.map((item, index) => (
                  <View key={index}>
                    <View style={styles.itemRow}>
                      {editing ? (
                        <TextInput
                          style={[styles.editInput, { flex: 1, marginRight: 12, textAlign: 'left' }]}
                          value={item.name}
                          onChangeText={(text) => updateItem(index, 'name', text)}
                          selectTextOnFocus
                        />
                      ) : (
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.name || 'Item'}
                          {item.quantity > 1 ? `  ×${item.quantity}` : ''}
                        </Text>
                      )}

                      {editing ? (
                        <TextInput
                          style={[styles.editInput, { width: 80, textAlign: 'right' }]}
                          value={item.price}
                          onChangeText={(text) => updateItem(index, 'price', text)}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                        />
                      ) : (
                        <Text style={styles.itemPrice}>${item.price || '0.00'}</Text>
                      )}
                    </View>
                    {index < items.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Price Breakdown */}
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>Price Breakdown</Text>
            <View style={styles.card}>
              <Field label="Subtotal" value={subtotal} onChangeText={setSubtotal} keyboardType="decimal-pad" editing={editing} />
              <View style={styles.divider} />
              <Field label="Discount" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" editing={editing} />
              <View style={styles.divider} />
              <Field label="Tax" value={tax} onChangeText={setTax} keyboardType="decimal-pad" editing={editing} />
              <View style={styles.divider} />
              <Field label="TOTAL" value={totalAmount} onChangeText={setTotalAmount} keyboardType="decimal-pad" editing={editing} />
            </View>
          </View>

          {/* Notes Section */}
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.card}>
              {editing ? (
                <TextInput
                  style={{ color: '#ffffff', fontSize: 15, minHeight: 80, textAlignVertical: 'top', paddingVertical: 8 }}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add a note about this receipt..."
                  placeholderTextColor="#6b7280"
                  multiline
                />
              ) : (
                <Text style={{ color: notes ? '#d1d5db' : '#6b7280', fontSize: 15, paddingVertical: 8 }}>
                  {notes || 'No notes yet. Tap Edit to add one.'}
                </Text>
              )}
            </View>
          </View>

          {/* OCR Raw Text Button */}
          {receipt.raw_text ? (
            <View style={{ marginTop: 20 }}>
              <TouchableOpacity
                style={styles.ocrButton}
                onPress={() => setShowOCR(true)}
              >
                <Text style={styles.ocrButtonText}>📄 View Raw OCR Text</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Scan Date */}
          <View style={{ marginTop: 20 }}>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Scanned on</Text>
                <Text style={styles.value}>
                  {receipt.created_at
                    ? new Date(receipt.created_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : 'Unknown'
                  }
                </Text>
              </View>
            </View>
          </View>

        </ScrollView>

        {/* Save Button - only shows in edit mode */}
        {editing && (
          <View style={styles.saveContainer}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Full Image Modal */}
      <Modal visible={showFullImage} animationType="fade" transparent={true}>
        <View style={styles.fullImageOverlay}>
          <TouchableOpacity
            style={styles.fullImageClose}
            onPress={() => setShowFullImage(false)}
          >
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
          {imageUrl && (
            <Image
              source={{ uri: imageUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* OCR Modal */}
      <Modal visible={showOCR} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Raw OCR Text</Text>
              <TouchableOpacity onPress={() => setShowOCR(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.ocrText}>{receipt.raw_text || 'No OCR text available'}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', paddingHorizontal: 16, paddingTop: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, marginBottom: 16 },
  backBtn: { color: '#3b82f6', fontSize: 17, fontWeight: '600' },
  deleteBtn: { color: '#ef4444', fontSize: 17, fontWeight: '600' },

  // Image
  imageBox: { backgroundColor: '#1f2937', borderRadius: 12, height: 250, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 16 },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  tapHint: { position: 'absolute', bottom: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  tapHintText: { color: '#9ca3af', fontSize: 12 },

  // Store name + Edit button
  storeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  storeName: { color: '#ffffff', fontSize: 28, fontWeight: '800', flex: 1 },
  storeNameInput: { color: '#ffffff', fontSize: 24, fontWeight: '800', flex: 1, paddingBottom: 4, marginRight: 12 },
  editBtn: { backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#374151' },
  editBtnText: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
  cancelBtn: { backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444' },
  cancelBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },

  // Cards
  card: { backgroundColor: '#1f2937', borderRadius: 12, padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  label: { color: '#9ca3af', fontSize: 15, flex: 1 },
  value: { color: '#ffffff', fontSize: 15, fontWeight: '600', textAlign: 'right', flex: 1 },
  editInput: { color: '#ffffff', fontSize: 15, fontWeight: '600', textAlign: 'right', paddingVertical: 4, paddingHorizontal: 4, flex: 1 },
  divider: { height: 1, backgroundColor: '#374151' },

  // Items
  sectionTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  itemName: { color: '#d1d5db', fontSize: 14, flex: 1, marginRight: 12 },
  itemPrice: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

  // Save button
  saveContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#030712', borderTopWidth: 1, borderTopColor: '#1f2937' },
  saveBtn: { backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },

  // OCR Button
  ocrButton: { backgroundColor: '#1f2937', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  ocrButtonText: { color: '#9ca3af', fontSize: 15, fontWeight: '600' },

  // Full image modal
  fullImageOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullImageClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  fullImage: { width: '95%', height: '80%' },

  // OCR Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111827', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  modalClose: { color: '#9ca3af', fontSize: 24, padding: 4 },
  modalScroll: { maxHeight: '90%' },
  ocrText: { color: '#d1d5db', fontSize: 13, fontFamily: 'monospace', lineHeight: 20 },
});