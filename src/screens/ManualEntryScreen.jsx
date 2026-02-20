/* eslint-disable react-native/no-inline-styles */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  StatusBar, Alert, ScrollView, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../config/supabase';

export default function ManualEntryScreen({ navigation }) {
  const [saving, setSaving] = useState(false);

  // Receipt fields
  const [storeName, setStoreName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Other');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [tax, setTax] = useState('');
  const [discount, setDiscount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);

  const categories = ['Food', 'Bills', 'Gas', 'Shopping', 'Medical', 'Other'];

  const addItem = () => {
    setItems([...items, { name: '', price: '', quantity: 1 }]);
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const checkDuplicate = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('id')
        .eq('user_id', userId)
        .eq('store_name', storeName.trim())
        .eq('date', date)
        .eq('total_amount', parseFloat(totalAmount) || 0);

      if (error) {
        console.log('Duplicate check error:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (err) {
      console.log('Duplicate check error:', err);
      return false;
    }
  };

  const saveReceipt = async (userId) => {
    const { error } = await supabase
      .from('receipts')
      .insert({
        user_id: userId,
        store_name: storeName.trim(),
        date: date || new Date().toISOString().split('T')[0],
        category: category,
        payment_method: paymentMethod || 'Unknown',
        subtotal: parseFloat(subtotal) || 0,
        tax: parseFloat(tax) || 0,
        discount: parseFloat(discount) || 0,
        total_amount: parseFloat(totalAmount) || 0,
        items: items.filter(i => i.name.trim()).map(item => ({
          name: item.name.trim(),
          price: parseFloat(item.price) || 0,
          quantity: parseInt(item.quantity, 10) || 1,
        })),
        notes: notes,
        status: 'completed',
        image_url: null,
        raw_text: null,
      });

    return error;
  };

  const handleSave = async () => {
    if (!storeName.trim()) {
      Alert.alert('Required', 'Please enter a store name');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in');
        setSaving(false);
        return;
      }

      // Check for duplicates
      const isDuplicate = await checkDuplicate(user.id);

      if (isDuplicate) {
        setSaving(false);
        Alert.alert(
          'Duplicate Receipt',
          `A receipt from ${storeName.trim()} on ${date} for $${parseFloat(totalAmount) || 0} already exists.\n\nWould you like to save it anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save Anyway',
              onPress: async () => {
                setSaving(true);
                const error = await saveReceipt(user.id);
                setSaving(false);
                if (error) {
                  Alert.alert('Error', 'Failed to save receipt');
                  console.log('Save error:', error);
                } else {
                  Alert.alert('Saved!', 'Receipt added successfully', [
                    { text: 'OK', onPress: () => navigation.navigate('Main', { screen: 'Home' }) },
                  ]);
                }
              },
            },
          ]
        );
        return;
      }

      // No duplicate — save normally
      const error = await saveReceipt(user.id);
      if (error) {
        Alert.alert('Error', 'Failed to save receipt');
        console.log('Save error:', error);
      } else {
        Alert.alert('Saved!', 'Receipt added successfully', [
          { text: 'OK', onPress: () => navigation.navigate('Main', { screen: 'Home' }) },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to save receipt');
      console.log('Save error:', err);
    } finally {
      setSaving(false);
    }
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
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Receipt</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

          {/* Store Name */}
          <Text style={styles.sectionTitle}>Store Details</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Store Name *</Text>
            <TextInput
              style={styles.input}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="Enter store name"
              placeholderTextColor="#6b7280"
            />
            <View style={styles.divider} />
            <Text style={styles.fieldLabel}>Date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#6b7280"
            />
            <View style={styles.divider} />
            <Text style={styles.fieldLabel}>Payment Method</Text>
            <TextInput
              style={styles.input}
              value={paymentMethod}
              onChangeText={setPaymentMethod}
              placeholder="Cash, Credit Card, Debit Card..."
              placeholderTextColor="#6b7280"
            />
          </View>

          {/* Category */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Category</Text>
          <View style={styles.categoryRow}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Items */}
          <View style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>Items</Text>
              <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
                <Text style={styles.addItemBtnText}>+ Add Item</Text>
              </TouchableOpacity>
            </View>
            {items.length > 0 ? (
              <View style={styles.card}>
                {items.map((item, index) => (
                  <View key={index}>
                    <View style={styles.itemEntry}>
                      <View style={{ flex: 1 }}>
                        <TextInput
                          style={[styles.input, { marginBottom: 8 }]}
                          value={item.name}
                          onChangeText={(text) => updateItem(index, 'name', text)}
                          placeholder="Item name"
                          placeholderTextColor="#6b7280"
                        />
                        <View style={{ flexDirection: 'row' }}>
                          <TextInput
                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                            value={item.price}
                            onChangeText={(text) => updateItem(index, 'price', text)}
                            placeholder="Price"
                            placeholderTextColor="#6b7280"
                            keyboardType="decimal-pad"
                          />
                          <TextInput
                            style={[styles.input, { width: 60 }]}
                            value={item.quantity.toString()}
                            onChangeText={(text) => updateItem(index, 'quantity', text)}
                            placeholder="Qty"
                            placeholderTextColor="#6b7280"
                            keyboardType="number-pad"
                          />
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.removeItemBtn}
                        onPress={() => removeItem(index)}
                      >
                        <Text style={styles.removeItemText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    {index < items.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.card, { alignItems: 'center', paddingVertical: 20 }]}>
                <Text style={{ color: '#6b7280', fontSize: 14 }}>No items added yet</Text>
              </View>
            )}
          </View>

          {/* Price Breakdown */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Price Breakdown</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Subtotal</Text>
            <TextInput
              style={styles.input}
              value={subtotal}
              onChangeText={setSubtotal}
              placeholder="0.00"
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
            />
            <View style={styles.divider} />
            <Text style={styles.fieldLabel}>Discount</Text>
            <TextInput
              style={styles.input}
              value={discount}
              onChangeText={setDiscount}
              placeholder="0.00"
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
            />
            <View style={styles.divider} />
            <Text style={styles.fieldLabel}>Tax</Text>
            <TextInput
              style={styles.input}
              value={tax}
              onChangeText={setTax}
              placeholder="0.00"
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
            />
            <View style={styles.divider} />
            <Text style={styles.fieldLabel}>Total</Text>
            <TextInput
              style={styles.input}
              value={totalAmount}
              onChangeText={setTotalAmount}
              placeholder="0.00"
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Notes */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Notes</Text>
          <View style={styles.card}>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about this receipt..."
              placeholderTextColor="#6b7280"
              multiline
            />
          </View>

        </ScrollView>

        {/* Save Button */}
        <View style={styles.saveContainer}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Receipt</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', paddingHorizontal: 16, paddingTop: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 25, marginBottom: 20 },
  backBtn: { color: '#3b82f6', fontSize: 17, fontWeight: '600' },
  headerTitle: { color: '#ffffff', fontSize: 20, fontWeight: '700' },

  sectionTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  card: { backgroundColor: '#1f2937', borderRadius: 12, padding: 16 },
  fieldLabel: { color: '#9ca3af', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: { color: '#ffffff', fontSize: 15, paddingVertical: 8 },
  divider: { height: 1, backgroundColor: '#374151', marginVertical: 4 },

  // Category chips
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#374151' },
  categoryChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  categoryText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  categoryTextActive: { color: '#ffffff' },

  // Items
  addItemBtn: { backgroundColor: '#1f2937', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#374151', marginBottom: 10 },
  addItemBtnText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
  itemEntry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  removeItemBtn: { marginLeft: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  removeItemText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },

  // Save button
  saveContainer: { padding: 16, backgroundColor: '#030712', borderTopWidth: 1, borderTopColor: '#1f2937' },
  saveBtn: { backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
});