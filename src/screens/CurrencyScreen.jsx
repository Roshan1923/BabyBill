import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, SafeAreaView, Modal, FlatList,
  ActivityIndicator, Animated,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";
import { supabase } from "../config/supabase";

const DS = {
  bgPage: "#FAF8F4", bgSurface: "#FFFEFB", bgSurface2: "#F5F2EC",
  brandNavy: "#1A3A6B", brandBlue: "#2563C8", accentGold: "#E8A020",
  accentGoldSub: "#FEF3DC", textPrimary: "#1C1610", textSecondary: "#8A7E72",
  textInverse: "#FFFEFB", positive: "#2A8C5C", negative: "#C8402A",
  border: "#EDE8E0", shadow: "rgba(26,58,107,0.10)",
};

const COUNTRY_DATA = {
  Canada: {
    currency: "CAD", defaultTax: "GST",
    taxOptions: [
      { value: "GST", label: "GST (5%)" },
      { value: "HST", label: "HST — ON, NB, NS, NL, PEI" },
      { value: "GST + PST", label: "GST + PST — BC, SK, MB" },
      { value: "GST + QST", label: "GST + QST — QC" },
    ],
  },
  "United States": {
    currency: "USD", defaultTax: "Sales Tax",
    taxOptions: [
      { value: "Sales Tax", label: "Sales Tax" },
      { value: "No Tax", label: "No Tax — OR, MT, NH, DE, AK" },
    ],
  },
  India: {
    currency: "INR", defaultTax: "GST",
    taxOptions: [
      { value: "GST", label: "GST" },
      { value: "IGST", label: "IGST — inter-state" },
      { value: "CGST + SGST", label: "CGST + SGST — intra-state" },
    ],
  },
};

const COUNTRIES = Object.keys(COUNTRY_DATA);

function DropdownField({ label, value, options, onSelect }) {
  const [visible, setVisible] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setVisible(true)} activeOpacity={0.7}>
        <Text style={styles.dropdownText}>{selected?.label || value}</Text>
        <Icon name="chevron-down" size={16} color={DS.textSecondary} />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList data={options} keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <TouchableOpacity style={[styles.modalOption, active && styles.modalOptionActive]}
                    onPress={() => { onSelect(item.value); setVisible(false); }} activeOpacity={0.7}>
                    <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>{item.label}</Text>
                    {active && <Ionicons name="checkmark" size={18} color={DS.brandNavy} />}
                  </TouchableOpacity>
                );
              }} />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function CurrencyRegionScreen({ navigation, route }) {
  const passedProfile = route?.params?.profile;

  const [country, setCountry] = useState(passedProfile?.country || "Canada");
  const [currency, setCurrency] = useState(passedProfile?.currency || "CAD");
  const [taxSystem, setTaxSystem] = useState(passedProfile?.tax_system || "GST");
  const [saving, setSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const originalCountry = passedProfile?.country || "Canada";
  const originalCurrency = passedProfile?.currency || "CAD";
  const originalTax = passedProfile?.tax_system || "GST";

  const hasChanges = country !== originalCountry || currency !== originalCurrency || taxSystem !== originalTax;

  const taxOptions = COUNTRY_DATA[country]?.taxOptions || [];
  const countryOptions = COUNTRIES.map((c) => ({ value: c, label: c }));
  const currencyOptions = [
    { value: "CAD", label: "CAD — Canadian Dollar" },
    { value: "USD", label: "USD — US Dollar" },
    { value: "INR", label: "INR — Indian Rupee" },
  ];

  const handleCountryChange = (val) => {
    setCountry(val);
    const data = COUNTRY_DATA[val];
    if (data) {
      setCurrency(data.currency);
      setTaxSystem(data.defaultTax);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("profiles").update({
        country, currency, tax_system: taxSystem,
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);

      if (error) {
        setErrorMessage(error.message);
        setShowErrorModal(true);
        setSaving(false);
        return;
      }

      setSaving(false);
      // Show success
      successScale.setValue(0);
      successOpacity.setValue(0);
      setShowSuccessModal(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }),
        Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        Animated.timing(successOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setShowSuccessModal(false);
          navigation.goBack();
        });
      }, 1500);
    } catch (e) {
      setSaving(false);
      setErrorMessage("Something went wrong. Please try again.");
      setShowErrorModal(true);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Currency & Region</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false} bounces={true}>

        <Text style={styles.sectionLabel}>REGION</Text>
        <View style={styles.card}>
          <DropdownField label="Country" value={country} options={countryOptions} onSelect={handleCountryChange} />
        </View>

        <Text style={styles.sectionLabel}>CURRENCY & TAX</Text>
        <View style={styles.card}>
          <DropdownField label="Currency" value={currency} options={currencyOptions} onSelect={setCurrency} />
          <DropdownField label="Tax System" value={taxSystem} options={taxOptions} onSelect={setTaxSystem} />
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={DS.textSecondary} />
          <Text style={styles.infoText}>
            Changing your country will automatically update your currency and tax system. These settings affect how receipts are processed and displayed.
          </Text>
        </View>

        {/* Save Button */}
        {hasChanges && (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
            {saving ? <ActivityIndicator size="small" color={DS.textInverse} /> :
              <><Icon name="check" size={18} color={DS.textInverse} /><Text style={styles.saveBtnText}>Save Changes</Text></>}
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="none">
        <Animated.View style={[styles.alertOverlay, { opacity: successOpacity }]}>
          <Animated.View style={[styles.alertContent, { transform: [{ scale: successScale }] }]}>
            <View style={[styles.alertIconCircle, { backgroundColor: DS.positive + "14" }]}>
              <Ionicons name="checkmark" size={28} color={DS.positive} />
            </View>
            <Text style={styles.alertTitle}>Saved!</Text>
            <Text style={styles.alertMessage}>Your preferences have been updated.</Text>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Error Modal */}
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
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginLeft: 4, marginTop: 8, color: DS.textSecondary },
  card: {
    backgroundColor: DS.bgSurface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4, borderWidth: 1, borderColor: DS.border, marginBottom: 24,
    ...Platform.select({ ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 }, android: { elevation: 2 } }),
  },
  fieldGroup: { paddingVertical: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: DS.textSecondary, marginBottom: 8, marginLeft: 2 },
  dropdownBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: DS.bgSurface2, borderRadius: 14, paddingHorizontal: 16, height: 50,
  },
  dropdownText: { fontSize: 15, fontWeight: "500", color: DS.textPrimary },
  infoBox: { flexDirection: "row", backgroundColor: DS.bgSurface2, borderRadius: 12, padding: 14, gap: 10 },
  infoText: { flex: 1, fontSize: 13, fontWeight: "400", color: DS.textSecondary, lineHeight: 18 },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", height: 54, borderRadius: 999, backgroundColor: DS.brandNavy, gap: 8, marginTop: 20,
    ...Platform.select({ ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16 }, android: { elevation: 4 } }),
  },
  saveBtnText: { fontSize: 15, fontWeight: "600", color: DS.textInverse },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: DS.bgSurface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, paddingBottom: Platform.OS === "ios" ? 40 : 24, paddingHorizontal: 20, maxHeight: "55%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: DS.textPrimary, marginBottom: 12 },
  modalOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: DS.border },
  modalOptionActive: { backgroundColor: DS.accentGoldSub, borderRadius: 10, paddingHorizontal: 12, marginHorizontal: -8, borderBottomWidth: 0 },
  modalOptionText: { fontSize: 15, fontWeight: "500", color: DS.textPrimary },
  modalOptionTextActive: { fontWeight: "700", color: DS.brandNavy },
  // Alert modals
  alertOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 32 },
  alertContent: { width: "100%", backgroundColor: DS.bgSurface, borderRadius: 24, padding: 28, alignItems: "center" },
  alertIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  alertTitle: { fontSize: 20, fontWeight: "700", color: DS.textPrimary, marginBottom: 8 },
  alertMessage: { fontSize: 14, fontWeight: "400", color: DS.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  alertBtn: { width: "100%", height: 48, borderRadius: 999, backgroundColor: DS.brandNavy, alignItems: "center", justifyContent: "center" },
  alertBtnText: { fontSize: 15, fontWeight: "600", color: DS.textInverse },
});