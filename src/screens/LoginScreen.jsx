import React, { useState, useRef } from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Icon from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
  Animated,
  StatusBar,
  SafeAreaView,
  Modal,
  Image,
} from 'react-native';
import { supabase } from '../config/supabase';

const BillBrainLogo = require('../assets/billbrain.png');

GoogleSignin.configure({
  webClientId: '841045886628-95d4qh7u3vfbi9cg7ssosublgmtoich1.apps.googleusercontent.com',
});

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

if (Platform.OS !== 'ios') {
  GoogleSignin.configure({
    webClientId: '841045886628-95d4qh7u3vfbi9cg7ssosublgmtoich1.apps.googleusercontent.com',
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  });
}

const LoginScreen = ({ navigation }) => {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Animations
  const loginScale = useRef(new Animated.Value(1)).current;
  const googleScale = useRef(new Animated.Value(1)).current;
  const appleScale = useRef(new Animated.Value(1)).current;

  const animPress = (anim) => Animated.spring(anim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const animRelease = (anim) => Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  // ─── Custom Modal State ──────────────────────────────────────
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

  // ─── Auth Handlers ───────────────────────────────────────────

  const handleLogin = async () => {
    if (!emailOrUsername.trim() || !password.trim()) {
      showModal('alert-circle', DS.accentGold, 'Missing Fields', 'Please enter your email/username and password.');
      return;
    }

    setLoading(true);
    try {
      let email = emailOrUsername.trim();

      if (!email.includes('@')) {
        const { data: foundEmail, error: lookupError } = await supabase.rpc('get_email_by_username', {
          lookup_username: email.toLowerCase(),
        });
        if (lookupError || !foundEmail) {
          showModal('alert-circle', DS.negative, 'Login Failed', 'Username not found. Please check and try again.');
          setLoading(false);
          return;
        }
        email = foundEmail;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        showModal('alert-circle', DS.negative, 'Login Failed', error.message);
      }
    } catch (err) {
      showModal('alert-circle', DS.negative, 'Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();

      const idToken = signInResult?.data?.idToken;
      if (!idToken) {
        showModal('alert-circle', DS.negative, 'Error', 'Failed to get Google ID token.');
        setGoogleLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        showModal('alert-circle', DS.negative, 'Google Sign-In Failed', error.message);
      }
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // Already in progress
      } else {
        showModal('alert-circle', DS.negative, 'Error', error.message || 'Google Sign-In failed.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    showModal('information-circle', DS.brandBlue, 'Coming Soon', 'Apple Sign-In will be available in a future update.');
  };

  const handleForgotPassword = async () => {
    if (!emailOrUsername.trim() || !emailOrUsername.includes('@')) {
      showModal('mail-outline', DS.accentGold, 'Enter Your Email', 'Please type your email address in the field above, then tap Forgot Password again.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailOrUsername.trim());
      if (error) {
        showModal('alert-circle', DS.negative, 'Error', error.message);
      } else {
        showModal('checkmark-circle', DS.positive, 'Check Your Email', 'A password reset link has been sent to your email.');
      }
    } catch (err) {
      showModal('alert-circle', DS.negative, 'Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* ── Brand Header ── */}
          <View style={styles.brandSection}>
            <Image
              source={BillBrainLogo}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>All Your Receipts. One Smart Brain.</Text>
          </View>

          {/* ── Login Card ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your account</Text>

            {/* Email / Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL OR USERNAME</Text>
              <View style={styles.inputRow}>
                <Icon name="user" size={16} color={DS.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter email or username"
                  placeholderTextColor={DS.textSecondary}
                  value={emailOrUsername}
                  onChangeText={setEmailOrUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <View style={styles.inputRow}>
                <Icon name="lock" size={16} color={DS.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter password"
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
            </View>

            {/* Forgot Password */}
            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn} activeOpacity={0.6}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              activeOpacity={1}
              onPressIn={() => animPress(loginScale)}
              onPressOut={() => animRelease(loginScale)}
              onPress={handleLogin}
              disabled={loading}
            >
              <Animated.View style={[styles.primaryBtn, { transform: [{ scale: loginScale }] }, loading && { opacity: 0.6 }]}>
                {loading ? (
                  <ActivityIndicator color={DS.textInverse} />
                ) : (
                  <Text style={styles.primaryBtnText}>Log In</Text>
                )}
              </Animated.View>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Buttons */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={() => animPress(googleScale)}
                onPressOut={() => animRelease(googleScale)}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                style={{ flex: 1 }}
              >
                <Animated.View style={[styles.socialBtn, { transform: [{ scale: googleScale }] }]}>
                  {googleLoading ? (
                    <ActivityIndicator size="small" color={DS.textPrimary} />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={18} color="#DB4437" />
                      <Text style={styles.socialBtnText}>Google</Text>
                    </>
                  )}
                </Animated.View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={1}
                onPressIn={() => animPress(appleScale)}
                onPressOut={() => animRelease(appleScale)}
                onPress={handleAppleSignIn}
                style={{ flex: 1 }}
              >
                <Animated.View style={[styles.socialBtn, { transform: [{ scale: appleScale }] }]}>
                  <Ionicons name="logo-apple" size={18} color={DS.textPrimary} />
                  <Text style={styles.socialBtnText}>Apple</Text>
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Register Link ── */}
          <View style={styles.bottomLink}>
            <Text style={styles.bottomLinkText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.6}>
              <Text style={styles.bottomLinkAction}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Custom Modal ── */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconCircle, { backgroundColor: modalIconColor + "14" }]}>
              <Ionicons name={modalIcon} size={24} color={modalIconColor} />
            </View>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DS.bgPage,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },

  // Brand
  brandSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoImage: {
    width: 400,
    height: 200,
    marginBottom: 0,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
    color: DS.textSecondary,
    marginTop: -30,
  },

  // Card
  card: {
    backgroundColor: DS.bgSurface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 28 },
      android: { elevation: 4 },
    }),
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: DS.textPrimary,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: DS.textSecondary,
    marginTop: 4,
    marginBottom: 24,
  },

  // Fields
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

  // Forgot
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: 2,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '500',
    color: DS.brandBlue,
  },

  // Primary Button
  primaryBtn: {
    backgroundColor: DS.brandNavy,
    borderRadius: 999,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: DS.textInverse,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: DS.border,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '500',
    color: DS.textSecondary,
    paddingHorizontal: 14,
  },

  // Social
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 999,
    backgroundColor: DS.bgSurface2,
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 1 },
    }),
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.textPrimary,
  },

  // Bottom Link
  bottomLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
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

  // ── Custom Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 32,
  },
  modalContent: {
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
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: DS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    fontWeight: '400',
    color: DS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalBtn: {
    width: '100%',
    height: 48,
    borderRadius: 999,
    backgroundColor: DS.brandNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.textInverse,
  },
});

export default LoginScreen;
