import React, { useState, useEffect } from 'react';
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
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { supabase } from '../config/supabase';

// Country → Currency mapping
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
      { value: 'IGST', label: 'IGST', desc: 'Integrated GST — inter-state transactions' },
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

// Reusable dropdown component
const DropdownPicker = ({ label, value, options, onSelect, displayKey = 'label', valueKey = 'value', descKey = null }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedLabel = options.find((o) => (typeof o === 'string' ? o : o[valueKey]) === value);
  const displayText = typeof selectedLabel === 'string'
    ? selectedLabel
    : selectedLabel
      ? selectedLabel[displayKey]
      : value;

  return (
    <View style={styles.inputWrapper}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.dropdownText}>{displayText}</Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => {
                const itemValue = typeof item === 'string' ? item : item[valueKey];
                const itemLabel = typeof item === 'string' ? item : item[displayKey];
                const itemDesc = descKey && typeof item !== 'string' ? item[descKey] : null;
                const isSelected = itemValue === value;

                return (
                  <TouchableOpacity
                    style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                    onPress={() => {
                      onSelect(itemValue);
                      setModalVisible(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                      {itemLabel}
                    </Text>
                    {itemDesc && (
                      <Text style={styles.modalOptionDesc}>{itemDesc}</Text>
                    )}
                    {isSelected && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const RegisterScreen = ({ navigation, onRegistrationStart }) => {
  // Step 1 - Account Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2 - Preferences
  const [country, setCountry] = useState('Canada');
  const [currency, setCurrency] = useState('CAD');
  const [taxSystem, setTaxSystem] = useState('GST');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // When country changes, auto-update currency and tax system
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
    if (!/^[a-z0-9_]*$/.test(username)) usernameErrors.push('Only lowercase letters, numbers, and underscores');
  }
  const usernameValid = username.length >= 3 && username.length <= 20 && /^[a-z0-9_]+$/.test(username);

  // Password validation
  const passwordCriteria = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'One special character (!@#$%^&*)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];
  const passwordValid = passwordCriteria.every((c) => c.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // Check username availability (debounced)
  useEffect(() => {
    if (!usernameValid) {
      setUsernameAvailable(null);
      return;
    }

    setUsernameChecking(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('check_username_available', {
          desired_username: username,
        });
        if (!error) {
          setUsernameAvailable(data);
        }
      } catch (err) {
        console.log('Username check error:', err);
      } finally {
        setUsernameChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, usernameValid]);

  // Step 1 validation
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
      Alert.alert('Incomplete', 'Please fill in all fields correctly before continuing.');
      return;
    }
    setCurrentStep(2);
  };

  const handleRegister = async () => {
    setLoading(true);

    try {
      // Tell App.jsx this is a new registration (so it shows welcome modal)
      if (onRegistrationStart) {
        onRegistrationStart();
      }

      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        Alert.alert('Registration Failed', authError.message);
        setLoading(false);
        return;
      }

      // Step 2: Create profile
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
        Alert.alert('Profile Error', 'Account created but profile setup failed. Please contact support.');
        setLoading(false);
        return;
      }

      // Auth listener in App.jsx will handle navigation + welcome modal
    } catch (err) {
      console.log('Registration error:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <>
      {/* First Name & Last Name */}
      <View style={styles.row}>
        <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.inputLabel}>First Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="John"
            placeholderTextColor="#555"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
        </View>
        <View style={[styles.inputWrapper, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.inputLabel}>Last Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Doe"
            placeholderTextColor="#555"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
        </View>
      </View>

      {/* Email */}
      <View style={styles.inputWrapper}>
        <Text style={styles.inputLabel}>Email Address *</Text>
        <TextInput
          style={styles.input}
          placeholder="john@example.com"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
      </View>

      {/* Username */}
      <View style={styles.inputWrapper}>
        <Text style={styles.inputLabel}>Username *</Text>
        <TextInput
          style={[
            styles.input,
            username.length > 0 && usernameValid && usernameAvailable === true && styles.inputSuccess,
            username.length > 0 && (usernameErrors.length > 0 || usernameAvailable === false) && styles.inputError,
          ]}
          placeholder="john_doe"
          placeholderTextColor="#555"
          value={username}
          onChangeText={(text) => setUsername(text.toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {username.length > 0 && (
          <View style={styles.feedbackContainer}>
            {usernameErrors.map((err, i) => (
              <Text key={i} style={styles.errorText}>✕ {err}</Text>
            ))}
            {usernameValid && usernameChecking && (
              <Text style={styles.checkingText}>⏳ Checking availability...</Text>
            )}
            {usernameValid && !usernameChecking && usernameAvailable === true && (
              <Text style={styles.successText}>✓ Username available!</Text>
            )}
            {usernameValid && !usernameChecking && usernameAvailable === false && (
              <Text style={styles.errorText}>✕ Username is already taken</Text>
            )}
          </View>
        )}
      </View>

      {/* Password */}
      <View style={styles.inputWrapper}>
        <Text style={styles.inputLabel}>Password *</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Create a strong password"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        {password.length > 0 && (
          <View style={styles.feedbackContainer}>
            {passwordCriteria.map((criterion, i) => (
              <Text
                key={i}
                style={criterion.met ? styles.successText : styles.errorText}
              >
                {criterion.met ? '✓' : '✕'} {criterion.label}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* Confirm Password */}
      <View style={styles.inputWrapper}>
        <Text style={styles.inputLabel}>Confirm Password *</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Re-enter password"
            placeholderTextColor="#555"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Text style={styles.eyeText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        {confirmPassword.length > 0 && (
          <Text style={passwordsMatch ? styles.successText : styles.errorText}>
            {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
          </Text>
        )}
      </View>

      {/* Next Button */}
      <TouchableOpacity
        style={[styles.primaryButton, !step1Valid && styles.primaryButtonDisabled]}
        onPress={handleNextStep}
        disabled={!step1Valid}
      >
        <Text style={styles.primaryButtonText}>Next — Preferences</Text>
      </TouchableOpacity>
    </>
  );

  const renderStep2 = () => {
    const currentTaxOptions = COUNTRY_DATA[country]?.taxOptions || [];

    return (
      <>
        {/* Back button */}
        <View style={styles.stepIndicator}>
          <TouchableOpacity onPress={() => setCurrentStep(1)}>
            <Text style={styles.backArrow}>← Back to Account Info</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionDesc}>
          Set your default region and tax preferences. These help BabyBill process your receipts accurately.
        </Text>

        {/* Country Dropdown */}
        <DropdownPicker
          label="Country *"
          value={country}
          options={COUNTRIES.map((c) => ({ value: c, label: c }))}
          onSelect={setCountry}
        />

        {/* Currency Dropdown */}
        <DropdownPicker
          label="Default Currency *"
          value={currency}
          options={CURRENCIES}
          onSelect={setCurrency}
        />

        {/* Tax System Dropdown */}
        <DropdownPicker
          label="Tax System *"
          value={taxSystem}
          options={currentTaxOptions}
          onSelect={setTaxSystem}
          descKey="desc"
        />

        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 You can change these settings anytime in your Profile. The tax system helps BabyBill categorize tax amounts on your receipts.
          </Text>
        </View>

        {/* Register Button */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.appName}>BabyBill</Text>
          <Text style={styles.formTitle}>Create Your Account</Text>
          <View style={styles.stepsRow}>
            <View style={[styles.stepDot, currentStep >= 1 && styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive]} />
          </View>
          <Text style={styles.stepLabel}>
            Step {currentStep} of 2: {currentStep === 1 ? 'Account Info' : 'Preferences'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          {currentStep === 1 ? renderStep1() : renderStep2()}
        </View>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#4a93f7',
    letterSpacing: 1,
    marginBottom: 8,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: '#3a3a3a',
  },
  stepDotActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 8,
  },
  stepLabel: {
    color: '#6b7280',
    fontSize: 14,
  },
  formSection: {
    width: '100%',
  },
  sectionDesc: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  inputSuccess: {
    borderColor: '#22c55e',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  eyeText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackContainer: {
    marginTop: 8,
    gap: 4,
  },
  successText: {
    color: '#22c55e',
    fontSize: 13,
    marginTop: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 4,
  },
  checkingText: {
    color: '#f59e0b',
    fontSize: 13,
    marginTop: 4,
  },
  stepIndicator: {
    marginBottom: 16,
  },
  backArrow: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  dropdown: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    color: '#fff',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6b7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  modalOptionSelected: {
    backgroundColor: '#1e3a5f',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#fff',
  },
  modalOptionTextSelected: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  modalOptionDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  checkMark: {
    fontSize: 18,
    color: '#3b82f6',
    fontWeight: '700',
    position: 'absolute',
    right: 24,
    top: 12,
  },
  modalCloseButton: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#1a2332',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  infoText: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  loginText: {
    color: '#6b7280',
    fontSize: 15,
  },
  loginLink: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default RegisterScreen;