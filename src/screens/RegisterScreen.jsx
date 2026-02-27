import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  Animated,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '../config/supabase';

// ─── Design System ───────────────────────────────────────────
const DS = {
  bgPage:        "#FAF8F4",
  bgSurface:     "#FFFEFB",
  bgSurface2:    "#F5F2EC",
  brandNavy:     "#1A3A6B",
  brandBlue:     "#2563C8",
  accentGold:    "#E8A020",
  accentGoldSub: "#FEF3DC",
  textPrimary:   "#1C1610",
  textSecondary: "#8A7E72",
  textInverse:   "#FFFEFB",
  positive:      "#2A8C5C",
  negative:      "#C8402A",
  border:        "#EDE8E0",
  shadow:        "rgba(26,58,107,0.10)",
};

// ─── Country / Currency / Tax Data ───────────────────────────
const COUNTRY_DATA = {
  Canada: {
    currency: 'CAD',
    defaultTax: 'GST',
    taxOptions: [
      { value: 'GST', label: 'GST', desc: 'Goods and Services Tax (5%)' },
      { value: 'HST', label: 'HST', desc: 'Harmonized Sales Tax — ON, NB, NS, NL, PEI' },
      { value: 'GST + PST', label: 'GST + PST', desc: 'GST + Provincial Sales Tax — BC, SK, MB, QC' },
      { value: 'GST + QST', label: 'GST + QST', desc: 'GST + Quebec Sales Tax — QC only' },
    ],
  },
  'United States': {
    currency: 'USD',
    defaultTax: 'Sales Tax',
    taxOptions: [
      { value: 'Sales Tax', label: 'Sales Tax', desc: 'State and local sales tax' },
      { value: 'No Tax', label: 'No Tax', desc: 'No sales tax (OR, MT, NH, DE, AK)' },
    ],
  },
  India: {
    currency: 'INR',
    defaultTax: 'GST',
    taxOptions: [
      { value: 'GST', label: 'GST', desc: 'Goods and Services Tax' },
      { value: 'IGST', label: 'IGST', desc: 'Integrated GST — inter-state' },
      { value: 'CGST + SGST', label: 'CGST + SGST', desc: 'Central + State GST — intra-state' },
    ],
  },
};

const COUNTRIES = Object.keys(COUNTRY_DATA);
const CURRENCIES = [
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'INR', label: 'INR — Indian Rupee' },
];

// ─── Dropdown Picker ─────────────────────────────────────────

function DropdownPicker({ label, value, options, onSelect, valueKey = 'value', displayKey = 'label', descKey = null }) {
  const [visible, setVisible] = useState(false);

  const selectedLabel = options.find((o) => (typeof o === 'string' ? o : o[valueKey]) === value);
  const displayText = typeof selectedLabel === 'string'
    ? selectedLabel
    : selectedLabel ? selectedLabel[displayKey] : value;

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdownBtn}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.dropdownText}>{displayText}</Text>
        <Icon name="chevron-down" size={16} color={DS.textSecondary} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item, i) => i.toString()}
              renderItem={({ item }) => {
                const val = typeof item === 'string' ? item : item[valueKey];
                const lab = typeof item === 'string' ? item : item[displayKey];
                const desc = descKey && typeof item !== 'string' ? item[descKey] : null;
                const active = val === value;
                return (
                  <TouchableOpacity
                    style={[styles.modalOption, active && styles.modalOptionActive]}
                    onPress={() => { onSelect(val); setVisible(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>{lab}</Text>
                      {desc && <Text style={styles.modalOptionDesc}>{desc}</Text>}
                    </View>
                    {active && <Ionicons name="checkmark" size={18} color={DS.brandNavy} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Register Screen ─────────────────────────────────────────

const RegisterScreen = ({ navigation, onRegistrationStart }) => {
  // Step 1 — Account Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2 — Preferences
  const [country, setCountry] = useState('Canada');
  const [currency, setCurrency] = useState('CAD');
  const [taxSystem, setTaxSystem] = useState('GST');

  // UI
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Animations
  const nextScale = useRef(new Animated.Value(1)).current;
  const registerScale = useRef(new Animated.Value(1)).current;

  const animPress = (anim) => Animated.spring(anim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const animRelease = (anim) => Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  // Custom modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalIcon, setModalIcon] = useState('alert-circle');
  const [modalIconColor, setModalIconColor] = useState(DS.negative);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const showModal = (icon, iconColor, title, message) => {
    setModalIcon(icon);
    setModalIconColor(iconColor);
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  // Auto-update currency and tax when country changes
  useEffect(() => {
    const data = COUNTRY_DATA[country];
    if (data) {
      setCurrency(data.currency);
      setTaxSystem(data.defaultTax);
    }
  }, [country]);

  // Username validation
  const usernameErrors = [];
  if (username.length > 0) {
    if (username.length < 3) usernameErrors.push('At least 3 characters');
    if (username.length > 20) usernameErrors.push('Maximum 20 characters');
    if (!/^[a-z0-9_]*$/.test(username)) usernameErrors.push('Only lowercase letters, numbers, underscores');
  }
  const usernameValid = username.length >= 3 && username.length <= 20 && /^[a-z0-9_]+$/.test(username);

  // Password validation
  const passwordCriteria = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'One special character', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];
  const passwordValid = passwordCriteria.every((c) => c.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // Check username availability (debounced)
  useEffect(() => {
    if (!usernameValid) { setUsernameAvailable(null); return; }
    setUsernameChecking(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('check_username_available', { desired_username: username });
        if (!error) setUsernameAvailable(data);
      } catch (err) { console.log('Username check error:', err); }
      finally { setUsernameChecking(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [username, usernameValid]);

  const step1Valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().includes('@') &&
    usernameValid &&
    usernameAvailable === true &&
    passwordValid &&
    passwordsMatch;

  const handleNextStep = () => {
    if (!step1Valid) {
      showModal('alert-circle', DS.accentGold, 'Incomplete', 'Please fill in all fields correctly.');
      return;
    }
    setCurrentStep(2);
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      if (onRegistrationStart) onRegistrationStart();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        showModal('alert-circle', DS.negative, 'Registration Failed', authError.message);
        setLoading(false);
        return;
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        username: username.toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        country: country,
        currency: currency,
        tax_system: taxSystem,
      });

      if (profileError) {
        console.log('Profile creation error:', profileError);
        showModal('alert-circle', DS.negative, 'Profile Error', 'Account created but profile setup failed.');
        setLoading(false);
        return;
      }
    } catch (err) {
      console.log('Registration error:', err);
      showModal('alert-circle', DS.negative, 'Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 1: Account Info ────────────────────────────────────

  const renderStep1 = () => (
    <>
      {/* First + Last Name */}
      <View style={styles.nameRow}>
        <View style={[styles.fieldGroup, { flex: 1, marginRight: 6 }]}>
          <Text style={styles.fieldLabel}>FIRST NAME *</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="John"
              placeholderTextColor={DS.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
          </View>
        </View>
        <View style={[styles.fieldGroup, { flex: 1, marginLeft: 6 }]}>
          <Text style={styles.fieldLabel}>LAST NAME *</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Doe"
              placeholderTextColor={DS.textSecondary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>
        </View>
      </View>

      {/* Email */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>EMAIL ADDRESS *</Text>
        <View style={styles.inputRow}>
          <Icon name="mail" size={16} color={DS.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="john@example.com"
            placeholderTextColor={DS.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Username */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>USERNAME *</Text>
        <View style={[
          styles.inputRow,
          username.length > 0 && usernameValid && usernameAvailable === true && { borderWidth: 1.5, borderColor: DS.positive },
          username.length > 0 && (usernameErrors.length > 0 || usernameAvailable === false) && { borderWidth: 1.5, borderColor: DS.negative },
        ]}>
          <Icon name="at-sign" size={16} color={DS.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="john_doe"
            placeholderTextColor={DS.textSecondary}
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {usernameChecking && <ActivityIndicator size="small" color={DS.accentGold} />}
          {!usernameChecking && usernameValid && usernameAvailable === true && (
            <Ionicons name="checkmark-circle" size={18} color={DS.positive} />
          )}
          {!usernameChecking && usernameValid && usernameAvailable === false && (
            <Ionicons name="close-circle" size={18} color={DS.negative} />
          )}
        </View>
        {username.length > 0 && (
          <View style={styles.feedbackList}>
            {usernameErrors.map((err, i) => (
              <Text key={i} style={styles.feedbackError}>{err}</Text>
            ))}
            {usernameValid && !usernameChecking && usernameAvailable === true && (
              <Text style={styles.feedbackSuccess}>Username available!</Text>
            )}
            {usernameValid && !usernameChecking && usernameAvailable === false && (
              <Text style={styles.feedbackError}>Username is taken</Text>
            )}
          </View>
        )}
      </View>

      {/* Password */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>PASSWORD *</Text>
        <View style={styles.inputRow}>
          <Icon name="lock" size={16} color={DS.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Create a strong password"
            placeholderTextColor={DS.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} activeOpacity={0.6}>
            <Icon name={showPassword ? "eye-off" : "eye"} size={18} color={DS.textSecondary} />
          </TouchableOpacity>
        </View>
        {password.length > 0 && (
          <View style={styles.feedbackList}>
            {passwordCriteria.map((c, i) => (
              <View key={i} style={styles.criteriaRow}>
                <Ionicons
                  name={c.met ? "checkmark-circle" : "close-circle"}
                  size={14}
                  color={c.met ? DS.positive : DS.textSecondary}
                />
                <Text style={[styles.criteriaText, { color: c.met ? DS.positive : DS.textSecondary }]}>
                  {c.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Confirm Password */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>CONFIRM PASSWORD *</Text>
        <View style={styles.inputRow}>
          <Icon name="lock" size={16} color={DS.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Re-enter password"
            placeholderTextColor={DS.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} activeOpacity={0.6}>
            <Icon name={showConfirmPassword ? "eye-off" : "eye"} size={18} color={DS.textSecondary} />
          </TouchableOpacity>
        </View>
        {confirmPassword.length > 0 && (
          <View style={styles.feedbackList}>
            <View style={styles.criteriaRow}>
              <Ionicons
                name={passwordsMatch ? "checkmark-circle" : "close-circle"}
                size={14}
                color={passwordsMatch ? DS.positive : DS.negative}
              />
              <Text style={{ fontSize: 13, fontWeight: '500', color: passwordsMatch ? DS.positive : DS.negative }}>
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Next Button */}
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => animPress(nextScale)}
        onPressOut={() => animRelease(nextScale)}
        onPress={handleNextStep}
        disabled={!step1Valid}
      >
        <Animated.View style={[styles.primaryBtn, { transform: [{ scale: nextScale }] }, !step1Valid && { opacity: 0.4 }]}>
          <Text style={styles.primaryBtnText}>Next — Preferences</Text>
          <Icon name="arrow-right" size={18} color={DS.textInverse} />
        </Animated.View>
      </TouchableOpacity>
    </>
  );

  // ─── Step 2: Preferences ─────────────────────────────────────

  const renderStep2 = () => {
    const currentTaxOptions = COUNTRY_DATA[country]?.taxOptions || [];

    return (
      <>
        {/* Back */}
        <TouchableOpacity onPress={() => setCurrentStep(1)} style={styles.backBtn} activeOpacity={0.6}>
          <Icon name="arrow-left" size={18} color={DS.brandBlue} />
          <Text style={styles.backBtnText}>Back to Account Info</Text>
        </TouchableOpacity>

        <Text style={styles.stepDesc}>
          Set your default region and tax preferences. These help BillBrain process your receipts accurately.
        </Text>

        <DropdownPicker
          label="COUNTRY *"
          value={country}
          options={COUNTRIES.map((c) => ({ value: c, label: c }))}
          onSelect={(val) => {
            setCountry(val);
            const data = COUNTRY_DATA[val];
            if (data) { setCurrency(data.currency); setTaxSystem(data.defaultTax); }
          }}
        />

        <DropdownPicker
          label="DEFAULT CURRENCY *"
          value={currency}
          options={CURRENCIES}
          onSelect={setCurrency}
        />

        <DropdownPicker
          label="TAX SYSTEM *"
          value={taxSystem}
          options={currentTaxOptions}
          onSelect={setTaxSystem}
          descKey="desc"
        />

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={DS.brandBlue} />
          <Text style={styles.infoText}>
            You can change these settings anytime in your profile. The tax system helps BillBrain categorize tax amounts on receipts.
          </Text>
        </View>

        {/* Register Button */}
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={() => animPress(registerScale)}
          onPressOut={() => animRelease(registerScale)}
          onPress={handleRegister}
          disabled={loading}
        >
          <Animated.View style={[styles.primaryBtn, styles.registerBtn, { transform: [{ scale: registerScale }] }, loading && { opacity: 0.6 }]}>
            {loading ? (
              <ActivityIndicator color={DS.textInverse} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={DS.textInverse} />
                <Text style={styles.primaryBtnText}>Create Account</Text>
              </>
            )}
          </Animated.View>
        </TouchableOpacity>
      </>
    );
  };

  // ─── Main Render ─────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* ── Header ── */}
          <View style={styles.headerSection}>
            <View style={styles.logoCircle}>
              <Ionicons name="receipt-outline" size={28} color={DS.textInverse} />
            </View>
            <Text style={styles.headerTitle}>Create Your Account</Text>

            {/* Step Indicator */}
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, styles.stepDotActive]}>
                <Text style={styles.stepDotText}>1</Text>
              </View>
              <View style={[styles.stepLine, currentStep >= 2 && styles.stepLineActive]} />
              <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, currentStep < 2 && { color: DS.textSecondary }]}>2</Text>
              </View>
            </View>
            <Text style={styles.stepLabel}>
              Step {currentStep} of 2: {currentStep === 1 ? 'Account Info' : 'Preferences'}
            </Text>
          </View>

          {/* ── Form Card ── */}
          <View style={styles.card}>
            {currentStep === 1 ? renderStep1() : renderStep2()}
          </View>

          {/* ── Login Link ── */}
          <View style={styles.bottomLink}>
            <Text style={styles.bottomLinkText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.6}>
              <Text style={styles.bottomLinkAction}>Log In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Custom Modal ── */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalAlertOverlay}>
          <View style={styles.modalAlertContent}>
            <View style={[styles.modalAlertIconCircle, { backgroundColor: modalIconColor + "14" }]}>
              <Ionicons name={modalIcon} size={24} color={modalIconColor} />
            </View>
            <Text style={styles.modalAlertTitle}>{modalTitle}</Text>
            <Text style={styles.modalAlertMessage}>{modalMessage}</Text>
            <TouchableOpacity
              style={styles.modalAlertBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalAlertBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DS.bgPage,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },

  // Header
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DS.brandNavy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 4 },
    }),
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: DS.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 16,
  },

  // Steps
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DS.bgSurface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: DS.border,
  },
  stepDotActive: {
    backgroundColor: DS.brandNavy,
    borderColor: DS.brandNavy,
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.textInverse,
  },
  stepLine: {
    width: 48,
    height: 2,
    backgroundColor: DS.border,
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: DS.brandNavy,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: DS.textSecondary,
  },

  // Card
  card: {
    backgroundColor: DS.bgSurface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 28 },
      android: { elevation: 4 },
    }),
  },

  // Fields
  nameRow: {
    flexDirection: 'row',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: DS.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.bgSurface2,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: DS.textPrimary,
    padding: 0,
  },

  // Feedback
  feedbackList: {
    marginTop: 8,
    marginLeft: 2,
    gap: 3,
  },
  feedbackSuccess: {
    fontSize: 13,
    fontWeight: '500',
    color: DS.positive,
  },
  feedbackError: {
    fontSize: 13,
    fontWeight: '500',
    color: DS.negative,
  },
  criteriaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  criteriaText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Dropdown
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DS.bgSurface2,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
  },
  dropdownText: {
    fontSize: 15,
    fontWeight: '500',
    color: DS.textPrimary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: DS.bgSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 20,
    maxHeight: '55%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DS.textPrimary,
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  modalOptionActive: {
    backgroundColor: DS.accentGoldSub,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: -8,
    borderBottomWidth: 0,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: DS.textPrimary,
  },
  modalOptionTextActive: {
    fontWeight: '700',
    color: DS.brandNavy,
  },
  modalOptionDesc: {
    fontSize: 12,
    fontWeight: '400',
    color: DS.textSecondary,
    marginTop: 2,
  },

  // Back button
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.brandBlue,
  },

  // Step description
  stepDesc: {
    fontSize: 14,
    fontWeight: '400',
    color: DS.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },

  // Info box
  infoBox: {
    flexDirection: 'row',
    backgroundColor: DS.brandNavy + "08",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: DS.brandNavy + "12",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: DS.textSecondary,
    lineHeight: 18,
  },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: DS.brandNavy,
    borderRadius: 999,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },
  registerBtn: {
    backgroundColor: DS.positive,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: DS.textInverse,
  },

  // Bottom link
  bottomLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  bottomLinkText: {
    fontSize: 14,
    fontWeight: '400',
    color: DS.textSecondary,
  },
  bottomLinkAction: {
    fontSize: 14,
    fontWeight: '700',
    color: DS.brandNavy,
  },

  // ── Custom Alert Modal ──
  modalAlertOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 32,
  },
  modalAlertContent: {
    width: '100%',
    backgroundColor: DS.bgSurface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 28 },
      android: { elevation: 8 },
    }),
  },
  modalAlertIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalAlertTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: DS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalAlertMessage: {
    fontSize: 14,
    fontWeight: '400',
    color: DS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalAlertBtn: {
    width: '100%',
    height: 48,
    borderRadius: 999,
    backgroundColor: DS.brandNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAlertBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.textInverse,
  },
});

export default RegisterScreen;