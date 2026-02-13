/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  StatusBar, Alert, ScrollView, Image, ActivityIndicator, Modal,
} from 'react-native';
import { supabase } from '../config/supabase';

export default function DetailScreen({ route, navigation }) {
  const { receipt } = route.params;
  const [imageUrl, setImageUrl] = useState(null);
  const [loadingImage, setLoadingImage] = useState(true);
  const [showOCR, setShowOCR] = useState(false);

  // Load signed URL for the receipt image
  useEffect(() => {
    const loadImage = async () => {
      if (receipt.image_url) {
        try {
          // image_url is like "receipt-images/receipt_123.jpg"
          // We need just the filename part after the bucket name
          const filePath = receipt.image_url.replace('receipt-images/', '');
          const { data, error } = await supabase.storage
            .from('receipt-images')
            .createSignedUrl(filePath, 3600); // 1 hour expiry

          if (data?.signedUrl) {
            setImageUrl(data.signedUrl);
          } else {
            console.log('Image URL error:', error?.message);
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

  const items = receipt.items || [];
  const hasFinancials = receipt.subtotal || receipt.tax || receipt.discount;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#030712" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete}>
          <Text style={styles.deleteBtn}>Delete</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Receipt Image */}
        <View style={styles.imageBox}>
          {loadingImage ? (
            <ActivityIndicator size="large" color="#3b82f6" />
          ) : imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={{ fontSize: 50 }}>🧾</Text>
              <Text style={{ color: '#6b7280', marginTop: 8 }}>Receipt image will show here</Text>
            </View>
          )}
        </View>

        {/* Store Name */}
        <Text style={styles.storeName}>{receipt.store_name || 'Unknown Store'}</Text>

        {/* Quick Info Card */}
        <View style={styles.card}>
          <InfoRow label="Date" value={receipt.date || 'Unknown'} />
          <View style={styles.divider} />
          <InfoRow label="Category" value={receipt.category || 'Other'} />
          <View style={styles.divider} />
          <InfoRow label="Payment" value={receipt.payment_method || 'Unknown'} />
          <View style={styles.divider} />
          <InfoRow label="Status" value={receipt.status || 'Unknown'}
            valueStyle={{ color: receipt.status === 'completed' ? '#22c55e' : '#f59e0b' }} />
        </View>

        {/* Items Section */}
        {items.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>Items ({items.length})</Text>
            <View style={styles.card}>
              {items.map((item, index) => (
                <View key={index}>
                  <View style={styles.itemRow}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name || 'Item'}
                      {item.quantity > 1 ? `  ×${item.quantity}` : ''}
                    </Text>
                    <Text style={styles.itemPrice}>${item.price || '0.00'}</Text>
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
            <InfoRow label="Subtotal" value={`$${receipt.subtotal || '0.00'}`} />
            <View style={styles.divider} />
            <InfoRow label="Discount" value={
              receipt.discount && receipt.discount !== '0.00'
                ? `-$${receipt.discount}`
                : 'None'
            } valueStyle={
              receipt.discount && receipt.discount !== '0.00'
                ? { color: '#22c55e' } : {}
            } />
            <View style={styles.divider} />
            <InfoRow label="Tax" value={`$${receipt.tax || '0.00'}`} />
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>${receipt.total_amount || '0.00'}</Text>
            </View>
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
            <InfoRow label="Scanned on"
              value={receipt.created_at
                ? new Date(receipt.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                : 'Unknown'
              }
            />
          </View>
        </View>

      </ScrollView>

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

// Reusable info row component
const InfoRow = ({ label, value, valueStyle = {} }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, valueStyle]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', paddingHorizontal: 16, paddingTop: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginBottom: 16 },
  backBtn: { color: '#3b82f6', fontSize: 17, fontWeight: '600' },
  deleteBtn: { color: '#ef4444', fontSize: 17, fontWeight: '600' },

  // Image
  imageBox: { backgroundColor: '#1f2937', borderRadius: 12, height: 250, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 16 },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },

  // Store name
  storeName: { color: '#ffffff', fontSize: 28, fontWeight: '800', marginBottom: 16 },

  // Cards
  card: { backgroundColor: '#1f2937', borderRadius: 12, padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  label: { color: '#9ca3af', fontSize: 15, flex: 1 },
  value: { color: '#ffffff', fontSize: 15, fontWeight: '600', textAlign: 'right', flex: 1 },
  divider: { height: 1, backgroundColor: '#374151' },

  // Items
  sectionTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  itemName: { color: '#d1d5db', fontSize: 14, flex: 1, marginRight: 12 },
  itemPrice: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

  // Total
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  totalLabel: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  totalValue: { color: '#3b82f6', fontSize: 22, fontWeight: '800' },

  // OCR Button
  ocrButton: { backgroundColor: '#1f2937', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  ocrButtonText: { color: '#9ca3af', fontSize: 15, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111827', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  modalClose: { color: '#9ca3af', fontSize: 24, padding: 4 },
  modalScroll: { maxHeight: '90%' },
  ocrText: { color: '#d1d5db', fontSize: 13, fontFamily: 'monospace', lineHeight: 20 },
});