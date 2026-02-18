/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import {
  View,
  Text,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

const TAGS = ['All', 'Food', 'Bills', 'Gas', 'Shopping', 'Medical', 'Other'];

const HomeScreen = ({navigation}) => {
  const [searchText, setSearchText] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [receipts, setReceipts] = useState([]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Fetch receipts from Supabase
  const fetchReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Supabase error:', error.message);
      } else {
        console.log('Loaded receipts:', data.length);
        setReceipts(data);
      }
    } catch (err) {
      console.log('Fetch error:', err);
    }
  };

  // Reload receipts every time Home screen gets focus
  useFocusEffect(
    useCallback(() => {
      fetchReceipts();
    }, [])
  );

  const filteredReceipts = receipts.filter((receipt) => {
    const matchesSearch =
      searchText === '' ||
      (receipt.store_name || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesTag =
      activeTag === 'All' || receipt.category === activeTag;
    return matchesSearch && matchesTag;
  });

  const renderReceipt = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('Detail', { receipt: item })}
      style={{
        flex: 1,
        backgroundColor: '#1f2937',
        borderRadius: 12,
        padding: 14,
        margin: 6,
        maxWidth: '48%',
      }}
    >
      <View
        style={{
          width: '100%',
          height: 80,
          backgroundColor: '#374151',
          borderRadius: 8,
          marginBottom: 10,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 30 }}>🧾</Text>
      </View>
      <Text
        style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}
        numberOfLines={1}
      >
        {item.store_name || 'Unknown Store'}
      </Text>
      <Text
        style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}
      >
        {item.date || 'No date'}
      </Text>
      <Text
        style={{ color: '#3b82f6', fontSize: 16, fontWeight: '700', marginTop: 6 }}
      >
        ${item.total_amount || '0.00'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030712', paddingTop: 15 }}>
      <StatusBar barStyle="light-content" backgroundColor="#030712" />

      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#ffffff', fontSize: 28, fontWeight: '800' }}>
          BabyBill
        </Text>
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: '#1f2937',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <TextInput
          style={{
            backgroundColor: '#1f2937',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            color: '#ffffff',
            fontSize: 15,
          }}
          placeholder="Search receipts..."
          placeholderTextColor="#6b7280"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Quick Tags */}
      <View style={{ paddingHorizontal: 10, marginBottom: 12 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TAGS}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setActiveTag(item)}
              style={{
                backgroundColor: activeTag === item ? '#3b82f6' : '#1f2937',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                marginHorizontal: 4,
              }}
            >
              <Text
                style={{
                  color: activeTag === item ? '#ffffff' : '#9ca3af',
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Receipt Grid or Empty State */}
      <FlatList
        data={filteredReceipts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 80, flexGrow: 1 }}
        renderItem={renderReceipt}
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 100,
            }}
          >
            <Text style={{ fontSize: 50, marginBottom: 16 }}>📸</Text>
            <Text
              style={{
                color: '#ffffff',
                fontSize: 18,
                fontWeight: '700',
                marginBottom: 6,
              }}
            >
              No receipts yet
            </Text>
            <Text
              style={{
                color: '#6b7280',
                fontSize: 14,
                textAlign: 'center',
                paddingHorizontal: 40,
              }}
            >
              Tap the Scan tab to capture your first receipt
            </Text>
          </View>
        }
      />

      {/* Floating LLM Chat Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Chat')}
        style={{
          position: 'absolute',
          bottom: 10,
          right: 20,
          backgroundColor: '#3b82f6',
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        }}
      >
        <Text style={{ fontSize: 26 }}>🤖</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default HomeScreen;