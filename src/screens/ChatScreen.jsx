import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';

const ChatScreen = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030712' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>AI Chat</Text>
        <Text style={{ color: '#9ca3af', marginTop: 8 }}>Ask about your receipts here</Text>
      </View>
    </SafeAreaView>
  );
};

export default ChatScreen;