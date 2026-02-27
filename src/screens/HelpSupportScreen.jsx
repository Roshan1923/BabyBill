import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, SafeAreaView, TextInput,
  ActivityIndicator, Modal, Animated, KeyboardAvoidingView,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";

const DS = {
  bgPage: "#FAF8F4", bgSurface: "#FFFEFB", bgSurface2: "#F5F2EC",
  brandNavy: "#1A3A6B", brandBlue: "#2563C8", accentGold: "#E8A020",
  accentGoldSub: "#FEF3DC", textPrimary: "#1C1610", textSecondary: "#8A7E72",
  textInverse: "#FFFEFB", positive: "#2A8C5C", negative: "#C8402A",
  border: "#EDE8E0", shadow: "rgba(26,58,107,0.10)",
};

const FUNCTION_URL = "https://jebizjtpvjowumixhczl.supabase.co/functions/v1/send-support-email";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYml6anRwdmpvd3VtaXhoY3psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDQ1MjUsImV4cCI6MjA4NjE4MDUyNX0.HBiArKVevlpU90d8VCuzceLJM1U1JI-53kGD8TMj9O4";

export default function HelpSupportScreen({ navigation, route }) {
  const passedUser = route?.params?.user;
  const passedProfile = route?.params?.profile;

  const firstName = passedProfile?.first_name || passedUser?.user_metadata?.first_name || "";
  const lastName = passedProfile?.last_name || passedUser?.user_metadata?.last_name || "";
  const userEmail = passedUser?.email || "";

  const [name, setName] = useState([firstName, lastName].filter(Boolean).join(" "));
  const [email, setEmail] = useState(userEmail);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const canSubmit = name.trim().length > 0 && email.trim().includes("@") && question.trim().length > 10;

  const handleSubmit = async () => {
    if (!canSubmit) {
      setShowValidationModal(true);
      return;
    }

    setSending(true);
    try {
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          question: question.trim(),
          userId: passedUser?.id || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setErrorMessage(result.error || "Failed to send message. Please try again.");
        setShowErrorModal(true);
        setSending(false);
        return;
      }

      setSending(false);
      successScale.setValue(0);
      successOpacity.setValue(0);
      setShowSuccessModal(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }),
        Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } catch (e) {
      setSending(false);
      setErrorMessage("Something went wrong. Please check your connection and try again.");
      setShowErrorModal(true);
    }
  };

  const handleSuccessDismiss = () => {
    Animated.timing(successOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setShowSuccessModal(false);
      navigation.goBack();
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBarBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Icon name="arrow-left" size={20} color={DS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Help & Support</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false} bounces={true} keyboardShouldPersistTaps="handled">

          <View style={styles.headerSection}>
            <View style={styles.headerIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={28} color={DS.brandNavy} />
            </View>
            <Text style={styles.headerTitle}>How can we help?</Text>
            <Text style={styles.headerSubtitle}>Send us your question and we'll get back to you within 2-3 business days.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>FULL NAME</Text>
              <View style={styles.inputRow}>
                <Icon name="user" size={16} color={DS.textSecondary} />
                <TextInput style={styles.input} value={name} onChangeText={setName}
                  placeholder="Your full name" placeholderTextColor={DS.textSecondary} autoCapitalize="words" />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <View style={styles.inputRow}>
                <Icon name="mail" size={16} color={DS.textSecondary} />
                <TextInput style={styles.input} value={email} onChangeText={setEmail}
                  placeholder="Your email" placeholderTextColor={DS.textSecondary}
                  keyboardType="email-address" autoCapitalize="none" />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>YOUR QUESTION</Text>
              <View style={[styles.inputRow, { height: 140, alignItems: "flex-start", paddingTop: 14 }]}>
                <Icon name="message-square" size={16} color={DS.textSecondary} style={{ marginTop: 2 }} />
                <TextInput style={[styles.input, { textAlignVertical: "top", height: 112 }]}
                  value={question} onChangeText={setQuestion}
                  placeholder="Describe your issue or question in detail..."
                  placeholderTextColor={DS.textSecondary}
                  multiline numberOfLines={6} />
              </View>
              <Text style={styles.charCount}>{question.length} / 10 min characters</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.submitBtn, !canSubmit && { opacity: 0.4 }]}
            onPress={handleSubmit} activeOpacity={0.8} disabled={sending}>
            {sending ? <ActivityIndicator size="small" color={DS.textInverse} /> :
              <><Ionicons name="send" size={18} color={DS.textInverse} /><Text style={styles.submitBtnText}>Submit</Text></>}
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showSuccessModal} transparent animationType="none">
        <Animated.View style={[styles.alertOverlay, { opacity: successOpacity }]}>
          <Animated.View style={[styles.alertContent, { transform: [{ scale: successScale }] }]}>
            <View style={[styles.alertIconCircle, { backgroundColor: DS.positive + "14" }]}>
              <Ionicons name="checkmark-circle" size={28} color={DS.positive} />
            </View>
            <Text style={styles.alertTitle}>Message Sent!</Text>
            <Text style={styles.alertMessage}>
              Thank you for reaching out. We'll review your question and get back to you within 2-3 business days at {email}.
            </Text>
            <TouchableOpacity style={styles.alertBtn} onPress={handleSuccessDismiss} activeOpacity={0.7}>
              <Text style={styles.alertBtnText}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      <Modal visible={showValidationModal} transparent animationType="fade" onRequestClose={() => setShowValidationModal(false)}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertContent}>
            <View style={[styles.alertIconCircle, { backgroundColor: DS.accentGold + "14" }]}>
              <Ionicons name="alert" size={24} color={DS.accentGold} />
            </View>
            <Text style={styles.alertTitle}>Incomplete Form</Text>
            <Text style={styles.alertMessage}>Please fill in your name, email, and a question with at least 10 characters.</Text>
            <TouchableOpacity style={styles.alertBtn} onPress={() => setShowValidationModal(false)} activeOpacity={0.7}>
              <Text style={styles.alertBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showErrorModal} transparent animationType="fade" onRequestClose={() => setShowErrorModal(false)}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertContent}>
            <View style={[styles.alertIconCircle, { backgroundColor: DS.negative + "14" }]}>
              <Ionicons name="warning" size={24} color={DS.negative} />
            </View>
            <Text style={styles.alertTitle}>Error</Text>
            <Text style={styles.alertMessage}>{errorMessage}</Text>
            <TouchableOpacity style={styles.alertBtn} onPress={() => setShowErrorModal(false)} activeOpacity={0.7}>
              <Text style={styles.alertBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 8 : 8, paddingBottom: 12,
  },
  topBarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: DS.bgSurface2, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 17, fontWeight: "600", color: DS.textPrimary },
  headerSection: { alignItems: "center", paddingVertical: 20 },
  headerIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: DS.brandNavy + "10",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: DS.textPrimary, letterSpacing: -0.2 },
  headerSubtitle: { fontSize: 14, fontWeight: "400", color: DS.textSecondary, textAlign: "center", marginTop: 6, lineHeight: 20, paddingHorizontal: 20 },
  card: {
    backgroundColor: DS.bgSurface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4, borderWidth: 1, borderColor: DS.border, marginBottom: 24,
    ...Platform.select({ ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 }, android: { elevation: 2 } }),
  },
  fieldGroup: { paddingVertical: 14 },
  fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginLeft: 2, color: DS.textSecondary },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: DS.bgSurface2, borderRadius: 14, paddingHorizontal: 16, height: 50, gap: 10 },
  input: { flex: 1, fontSize: 15, fontWeight: "500", color: DS.textPrimary, padding: 0 },
  charCount: { fontSize: 11, fontWeight: "400", color: DS.textSecondary, marginTop: 6, marginLeft: 2 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", height: 54, borderRadius: 999, backgroundColor: DS.brandNavy, gap: 8,
    ...Platform.select({ ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16 }, android: { elevation: 4 } }),
  },
  submitBtnText: { fontSize: 15, fontWeight: "600", color: DS.textInverse },
  alertOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 32 },
  alertContent: { width: "100%", backgroundColor: DS.bgSurface, borderRadius: 24, padding: 28, alignItems: "center" },
  alertIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  alertTitle: { fontSize: 20, fontWeight: "700", color: DS.textPrimary, marginBottom: 8 },
  alertMessage: { fontSize: 14, fontWeight: "400", color: DS.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  alertBtn: { width: "100%", height: 48, borderRadius: 999, backgroundColor: DS.brandNavy, alignItems: "center", justifyContent: "center" },
  alertBtnText: { fontSize: 15, fontWeight: "600", color: DS.textInverse },
});