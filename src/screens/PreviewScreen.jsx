/* eslint-disable react-native/no-inline-styles */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { API_URL } from '../config/api';

export default function PreviewScreen({ route, navigation }) {
  const { photoPath } = route.params;
  const photoUri = 'file://' + photoPath;
  const [uploading, setUploading] = useState(false);

  const handleRetake = () => {
    navigation.goBack();
  };

  const handleConfirm = async () => {
    setUploading(true);

    try {
      // Create form data with the photo
      const formData = new FormData();
      formData.append('image', {
        uri: photoUri,
        type: 'image/jpeg',
        name: `receipt_${Date.now()}.jpg`,
      });

      console.log('📤 Sending photo to backend...');

      const response = await fetch(`${API_URL}/process-receipt`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Receipt processed!', result.receipt);
        Alert.alert(
          'Receipt Processed!',
          `Store: ${result.receipt.store_name}\nTotal: $${result.receipt.total_amount}`,
          [
            { text: 'Scan Another', onPress: () => navigation.navigate('Main', { screen: 'Scan' }) },
            { text: 'Go Home', onPress: () => navigation.navigate('Main', { screen: 'Home' }) },
          ]
        );
      } else {
        console.log('❌ Error:', result.error);
        Alert.alert('Error', result.error || 'Failed to process receipt');
      }
    } catch (error) {
      console.log('❌ Network error:', error);
      Alert.alert(
        'Connection Error',
        'Could not reach the server. Make sure the backend is running and you are on the same WiFi network.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#030712" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Preview</Text>
      </View>

      {/* Photo */}
      <View style={styles.imageBox}>
        <Image
          source={{ uri: photoUri }}
          style={styles.image}
          resizeMode="contain"
        />

        {/* Uploading overlay */}
        {uploading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.overlayText}>Processing receipt...</Text>
            <Text style={styles.overlaySubtext}>This may take 10-15 seconds</Text>
          </View>
        )}
      </View>

      {/* Buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.retakeBtn, uploading && styles.disabledBtn]}
          onPress={handleRetake}
          disabled={uploading}
        >
          <Text style={styles.btnText}>↻ Retake</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, uploading && styles.disabledBtn]}
          onPress={handleConfirm}
          disabled={uploading}
        >
          <Text style={styles.btnText}>
            {uploading ? 'Processing...' : 'Confirm ✓'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 20, paddingTop: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingTop: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  imageBox: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1f2937' },
  image: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16 },
  overlaySubtext: { color: '#9ca3af', fontSize: 13, marginTop: 6 },
  btnRow: { flexDirection: 'row', marginTop: 15 },
  retakeBtn: { backgroundColor: '#4b5563', paddingVertical: 15, borderRadius: 10, flex: 1, marginRight: 10, alignItems: 'center' },
  confirmBtn: { backgroundColor: '#22c55e', paddingVertical: 15, borderRadius: 10, flex: 1, marginLeft: 10, alignItems: 'center' },
  disabledBtn: { opacity: 0.5 },
  btnText: { fontSize: 18, color: '#fff', fontWeight: '600' },
});