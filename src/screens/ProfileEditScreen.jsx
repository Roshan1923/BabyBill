import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Platform, StatusBar, SafeAreaView, Animated, Modal, ActivityIndicator,
  KeyboardAvoidingView, Image, Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";
import { launchImageLibrary } from "react-native-image-picker";
import { supabase } from "../config/supabase";
import RNFS from "react-native-fs";
import { decode } from "base64-arraybuffer";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DS = {
  bgPage: "#FAF8F4", bgSurface: "#FFFEFB", bgSurface2: "#F5F2EC",
  brandNavy: "#1A3A6B", brandBlue: "#2563C8", accentGold: "#E8A020",
  accentGoldSub: "#FEF3DC", textPrimary: "#1C1610", textSecondary: "#8A7E72",
  textInverse: "#FFFEFB", positive: "#2A8C5C", negative: "#C8402A",
  border: "#EDE8E0", shadow: "rgba(26,58,107,0.10)",
};

export default function ProfileEditScreen({ navigation, route }) {
  const passedUser = route?.params?.user;
  const passedProfile = route?.params?.profile;

  const [firstName, setFirstName] = useState(
    passedProfile?.first_name || passedUser?.user_metadata?.first_name || passedUser?.user_metadata?.full_name?.split(" ")[0] || ""
  );
  const [lastName, setLastName] = useState(
    passedProfile?.last_name || passedUser?.user_metadata?.last_name || passedUser?.user_metadata?.full_name?.split(" ").slice(1).join(" ") || ""
  );
  const [email, setEmail] = useState(passedUser?.email || "");
  const [phone, setPhone] = useState(passedUser?.user_metadata?.phone || passedUser?.phone || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);

  // Modals
  const [saving, setSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeletePhotoModal, setShowDeletePhotoModal] = useState(false);

  // Animations
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const previewOpacity = useRef(new Animated.Value(0)).current;
  const previewScale = useRef(new Animated.Value(0.8)).current;

  // Originals
  const origFirstName = passedProfile?.first_name || passedUser?.user_metadata?.first_name || passedUser?.user_metadata?.full_name?.split(" ")[0] || "";
  const origLastName = passedProfile?.last_name || passedUser?.user_metadata?.last_name || passedUser?.user_metadata?.full_name?.split(" ").slice(1).join(" ") || "";
  const origEmail = passedUser?.email || "";
  const origPhone = passedUser?.user_metadata?.phone || passedUser?.phone || "";

  const hasChanges =
    firstName !== origFirstName ||
    lastName !== origLastName ||
    email !== origEmail ||
    phone !== origPhone ||
    newPassword.length > 0;

  const initial = (firstName || "U").charAt(0).toUpperCase();

  useEffect(() => { loadAvatar(); }, []);

  const loadAvatar = async () => {
    try {
      if (!passedProfile?.avatar_url) return;
      const { data } = await supabase.storage
        .from("avtars")
        .createSignedUrl(passedProfile.avatar_url, 3600);
      if (data?.signedUrl) setAvatarUrl(data.signedUrl);
    } catch (e) {
      console.error("Error loading avatar:", e);
    }
  };

  // Open fullscreen photo preview
  const openPhotoPreview = () => {
    if (!avatarUrl) return;
    setShowPhotoPreview(true);
    previewOpacity.setValue(0);
    previewScale.setValue(0.8);
    Animated.parallel([
      Animated.timing(previewOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(previewScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 4 }),
    ]).start();
  };

  const closePhotoPreview = () => {
    Animated.timing(previewOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowPhotoPreview(false);
    });
  };

  // Avatar tap — if has photo, open preview. If no photo, open picker.
  const handleAvatarTap = () => {
    if (avatarUrl) {
      openPhotoPreview();
    } else {
      handlePickAvatar();
    }
  };

  const handlePickAvatar = () => {
    launchImageLibrary(
      { mediaType: "photo", quality: 0.7, selectionLimit: 1, maxWidth: 512, maxHeight: 512 },
      async (response) => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (!asset?.uri) return;

        setUploadingAvatar(true);
        try {
          const userId = passedUser?.id;
          if (!userId) throw new Error("No user ID");

          const fileExt = (asset.fileName?.split(".").pop() || "jpg").toLowerCase();
          const filePath = `${userId}/avatar.${fileExt}`;
          const contentType = asset.type || "image/jpeg";

          let uri = asset.uri;
          if (Platform.OS !== "android" && uri.startsWith("file://")) {
            uri = uri.replace("file://", "");
          }

          const base64Data = await RNFS.readFile(
            Platform.OS === "android" ? asset.uri : uri,
            "base64"
          );

          const arrayBuffer = decode(base64Data);

          const { error: uploadError } = await supabase.storage
            .from("avtars")
            .upload(filePath, arrayBuffer, { contentType, upsert: true });

          if (uploadError) {
            setErrorMessage("Upload failed: " + uploadError.message);
            setShowErrorModal(true);
            setUploadingAvatar(false);
            return;
          }

          const { error: updateError } = await supabase
            .from("profiles")
            .update({ avatar_url: filePath, updated_at: new Date().toISOString() })
            .eq("id", userId);

          if (updateError) {
            setErrorMessage("Photo uploaded but failed to save: " + updateError.message);
            setShowErrorModal(true);
            setUploadingAvatar(false);
            return;
          }

          const { data: signedData } = await supabase.storage
            .from("avtars")
            .createSignedUrl(filePath, 3600);
          if (signedData?.signedUrl) setAvatarUrl(signedData.signedUrl);
        } catch (e) {
          console.error("Avatar upload error:", e);
          setErrorMessage("Failed to upload photo: " + (e.message || "Unknown error"));
          setShowErrorModal(true);
        } finally {
          setUploadingAvatar(false);
        }
      }
    );
  };

  const handleRemoveAvatar = async () => {
    setShowDeletePhotoModal(false);
    setShowPhotoPreview(false);
    try {
      setUploadingAvatar(true);
      const userId = passedUser?.id;
      if (!userId) return;

      // Delete from storage
      const avatarPath = passedProfile?.avatar_url;
      if (avatarPath) {
        await supabase.storage.from("avtars").remove([avatarPath]);
      }

      await supabase
        .from("profiles")
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq("id", userId);

      setAvatarUrl(null);
    } catch (e) {
      console.error("Error removing avatar:", e);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const playSuccessAnimation = () => {
    successScale.setValue(0);
    successOpacity.setValue(0);
    checkScale.setValue(0);
    setShowSuccessModal(true);
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }),
      Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 12, delay: 150 }),
    ]).start();
    setTimeout(() => {
      Animated.timing(successOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setShowSuccessModal(false);
        navigation.goBack();
      });
    }, 1500);
  };

  const handleSave = async () => {
    if (newPassword.length > 0) {
      if (newPassword.length < 6) {
        setErrorMessage("New password must be at least 6 characters.");
        setShowErrorModal(true);
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        setShowErrorModal(true);
        return;
      }
    }
    if (!firstName.trim()) {
      setErrorMessage("First name is required.");
      setShowErrorModal(true);
      return;
    }

    try {
      setSaving(true);
      const userId = passedUser?.id;

      if (firstName !== origFirstName || lastName !== origLastName) {
        const { error: nameError } = await supabase
          .from("profiles")
          .update({ first_name: firstName.trim(), last_name: lastName.trim(), updated_at: new Date().toISOString() })
          .eq("id", userId);
        if (nameError) { setErrorMessage(nameError.message); setShowErrorModal(true); setSaving(false); return; }
      }

      if (email !== origEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
        if (emailError) { setErrorMessage(emailError.message); setShowErrorModal(true); setSaving(false); return; }
        setSaving(false);
        setShowEmailModal(true);
        return;
      }

      if (newPassword.length > 0) {
        const { error: passError } = await supabase.auth.updateUser({ password: newPassword });
        if (passError) { setErrorMessage(passError.message); setShowErrorModal(true); setSaving(false); return; }
      }

      if (phone !== origPhone) {
        const { error: metaError } = await supabase.auth.updateUser({ data: { phone } });
        if (metaError) { setErrorMessage(metaError.message); setShowErrorModal(true); setSaving(false); return; }
      }

      setSaving(false);
      playSuccessAnimation();
    } catch (e) {
      setSaving(false);
      setErrorMessage("Something went wrong. Please try again.");
      setShowErrorModal(true);
    }
  };

  const handleBack = () => {
    if (hasChanges) setShowDiscardModal(true);
    else navigation.goBack();
  };

  return (
    <SafeAreaView style={st.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={st.topBar}>
          <TouchableOpacity style={st.topBarBtn} onPress={handleBack} activeOpacity={0.7}>
            <Icon name="arrow-left" size={20} color={DS.textPrimary} />
          </TouchableOpacity>
          <Text style={st.topBarTitle}>Edit Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}
          showsVerticalScrollIndicator={false} bounces={true} keyboardShouldPersistTaps="handled">

          {/* Avatar */}
          <View style={st.avatarSection}>
            <View style={st.avatarWrapper}>
              {/* Tap photo = preview (if photo) or pick (if no photo) */}
              <TouchableOpacity onPress={handleAvatarTap} activeOpacity={0.8} disabled={uploadingAvatar}>
                <View style={st.avatarOuter}>
                  {uploadingAvatar ? (
                    <View style={st.avatarCircle}>
                      <ActivityIndicator size="small" color={DS.textInverse} />
                    </View>
                  ) : avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={st.avatarImage} />
                  ) : (
                    <View style={st.avatarCircle}>
                      <Text style={st.avatarText}>{initial}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              {/* Pencil icon — always opens picker */}
              <TouchableOpacity style={st.editBadge} onPress={handlePickAvatar} activeOpacity={0.7} disabled={uploadingAvatar}>
                <Icon name="edit-2" size={13} color={DS.textInverse} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Personal Info */}
          <Text style={st.sectionLabel}>PERSONAL INFORMATION</Text>
          <View style={st.card}>
            <View style={st.fieldRow}>
              <Text style={st.fieldLabel}>First Name</Text>
              <View style={st.inputContainer}>
                <Icon name="user" size={16} color={DS.textSecondary} style={{ marginRight: 10 }} />
                <TextInput style={st.input} value={firstName} onChangeText={setFirstName}
                  placeholder="Enter first name" placeholderTextColor={DS.textSecondary} autoCapitalize="words" />
              </View>
            </View>
            <View style={[st.fieldRow, { borderBottomWidth: 0 }]}>
              <Text style={st.fieldLabel}>Last Name</Text>
              <View style={st.inputContainer}>
                <Icon name="user" size={16} color={DS.textSecondary} style={{ marginRight: 10 }} />
                <TextInput style={st.input} value={lastName} onChangeText={setLastName}
                  placeholder="Enter last name" placeholderTextColor={DS.textSecondary} autoCapitalize="words" />
              </View>
            </View>
          </View>

          {/* Contact Info */}
          <Text style={st.sectionLabel}>CONTACT INFORMATION</Text>
          <View style={st.card}>
            <View style={st.fieldRow}>
              <Text style={st.fieldLabel}>Email Address</Text>
              <View style={st.inputContainer}>
                <Icon name="mail" size={16} color={DS.textSecondary} style={{ marginRight: 10 }} />
                <TextInput style={st.input} value={email} onChangeText={setEmail}
                  keyboardType="email-address" autoCapitalize="none"
                  placeholder="Enter email" placeholderTextColor={DS.textSecondary} />
              </View>
              {email !== origEmail && email.includes("@") && (
                <View style={st.emailHint}>
                  <Ionicons name="information-circle-outline" size={14} color={DS.brandBlue} />
                  <Text style={st.emailHintText}>A confirmation link will be sent to your new email</Text>
                </View>
              )}
            </View>
            <View style={[st.fieldRow, { borderBottomWidth: 0 }]}>
              <View style={st.fieldLabelRow}>
                <Text style={st.fieldLabel}>Phone Number</Text>
                <View style={st.optionalBadge}><Text style={st.optionalText}>Optional</Text></View>
              </View>
              <View style={st.inputContainer}>
                <Icon name="phone" size={16} color={DS.textSecondary} style={{ marginRight: 10 }} />
                <TextInput style={st.input} value={phone} onChangeText={setPhone}
                  keyboardType="phone-pad" placeholder="Enter phone number" placeholderTextColor={DS.textSecondary} />
              </View>
            </View>
          </View>

          {/* Change Password */}
          <Text style={st.sectionLabel}>CHANGE PASSWORD</Text>
          <View style={st.card}>
            <View style={st.fieldRow}>
              <Text style={st.fieldLabel}>New Password</Text>
              <View style={st.inputContainer}>
                <Icon name="lock" size={16} color={DS.textSecondary} style={{ marginRight: 10 }} />
                <TextInput style={st.input} value={newPassword} onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword} placeholder="Enter new password" placeholderTextColor={DS.textSecondary} />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} activeOpacity={0.6}>
                  <Icon name={showNewPassword ? "eye-off" : "eye"} size={18} color={DS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={[st.fieldRow, { borderBottomWidth: 0 }]}>
              <Text style={st.fieldLabel}>Confirm Password</Text>
              <View style={st.inputContainer}>
                <Icon name="lock" size={16} color={DS.textSecondary} style={{ marginRight: 10 }} />
                <TextInput style={st.input} value={confirmPassword} onChangeText={setConfirmPassword}
                  secureTextEntry={!showNewPassword} placeholder="Confirm new password" placeholderTextColor={DS.textSecondary} />
                {newPassword.length > 0 && confirmPassword.length > 0 && (
                  <Ionicons name={newPassword === confirmPassword ? "checkmark-circle" : "close-circle"}
                    size={20} color={newPassword === confirmPassword ? DS.positive : DS.negative} />
                )}
              </View>
            </View>
          </View>

          {/* Save */}
          {hasChanges && (
            <TouchableOpacity style={st.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              {saving ? <ActivityIndicator size="small" color={DS.textInverse} /> :
                <><Icon name="check" size={18} color={DS.textInverse} /><Text style={st.saveBtnText}>Save Changes</Text></>}
            </TouchableOpacity>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Photo Fullscreen Preview ── */}
      <Modal visible={showPhotoPreview} transparent animationType="none" onRequestClose={closePhotoPreview}>
        <Animated.View style={[st.previewOverlay, { opacity: previewOpacity }]}>
          {/* Close button */}
          <TouchableOpacity style={st.previewClose} onPress={closePhotoPreview} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Photo */}
          <Animated.View style={{ transform: [{ scale: previewScale }] }}>
            <Image source={{ uri: avatarUrl }} style={st.previewImage} resizeMode="contain" />
          </Animated.View>

          {/* Bottom actions */}
          <View style={st.previewActions}>
            <TouchableOpacity style={st.previewActionBtn} onPress={() => { closePhotoPreview(); setTimeout(handlePickAvatar, 400); }} activeOpacity={0.7}>
              <Icon name="edit-2" size={18} color="#FFFFFF" />
              <Text style={st.previewActionText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.previewActionBtn, st.previewDeleteBtn]}
              onPress={() => setShowDeletePhotoModal(true)} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={18} color={DS.negative} />
              <Text style={[st.previewActionText, { color: DS.negative }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>

      {/* ── Delete Photo Confirmation ── */}
      <Modal visible={showDeletePhotoModal} transparent animationType="fade" onRequestClose={() => setShowDeletePhotoModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={[st.modalIconCircle, { backgroundColor: DS.negative + "14" }]}>
              <Ionicons name="trash-outline" size={24} color={DS.negative} />
            </View>
            <Text style={st.modalTitle}>Remove Photo?</Text>
            <Text style={st.modalMessage}>Your profile will show your name initial instead.</Text>
            <View style={st.modalActions}>
              <TouchableOpacity style={st.modalBtnSecondary} onPress={() => setShowDeletePhotoModal(false)} activeOpacity={0.7}>
                <Text style={st.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.modalBtnDanger} onPress={handleRemoveAvatar} activeOpacity={0.7}>
                <Text style={st.modalBtnDangerText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Success Modal ── */}
      <Modal visible={showSuccessModal} transparent animationType="none">
        <Animated.View style={[st.modalOverlay, { opacity: successOpacity }]}>
          <Animated.View style={[st.modalContent, { transform: [{ scale: successScale }] }]}>
            <Animated.View style={[st.successCircle, { transform: [{ scale: checkScale }] }]}>
              <Ionicons name="checkmark" size={28} color={DS.textInverse} />
            </Animated.View>
            <Text style={st.modalTitle}>Saved!</Text>
            <Text style={st.modalMessage}>Your profile has been updated.</Text>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* ── Email Confirmation Modal ── */}
      <Modal visible={showEmailModal} transparent animationType="fade" onRequestClose={() => setShowEmailModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={[st.modalIconCircle, { backgroundColor: DS.brandBlue + "14" }]}>
              <Ionicons name="mail-outline" size={24} color={DS.brandBlue} />
            </View>
            <Text style={st.modalTitle}>Check Your Email</Text>
            <Text style={st.modalMessage}>
              We've sent a confirmation link to{"\n"}
              <Text style={{ fontWeight: "700", color: DS.textPrimary }}>{email}</Text>
              {"\n\n"}Click the link to confirm your new address. Your email won't change until you confirm.
            </Text>
            <TouchableOpacity style={st.modalBtnFull} onPress={() => { setShowEmailModal(false); navigation.goBack(); }} activeOpacity={0.7}>
              <Text style={st.modalBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Error Modal ── */}
      <Modal visible={showErrorModal} transparent animationType="fade" onRequestClose={() => setShowErrorModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={[st.modalIconCircle, { backgroundColor: DS.negative + "14" }]}>
              <Ionicons name="warning" size={24} color={DS.negative} />
            </View>
            <Text style={st.modalTitle}>Error</Text>
            <Text style={st.modalMessage}>{errorMessage}</Text>
            <TouchableOpacity style={st.modalBtnFull} onPress={() => setShowErrorModal(false)} activeOpacity={0.7}>
              <Text style={st.modalBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Discard Modal ── */}
      <Modal visible={showDiscardModal} transparent animationType="fade" onRequestClose={() => setShowDiscardModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={[st.modalIconCircle, { backgroundColor: DS.accentGoldSub }]}>
              <Ionicons name="alert" size={24} color={DS.accentGold} />
            </View>
            <Text style={st.modalTitle}>Unsaved Changes</Text>
            <Text style={st.modalMessage}>You have unsaved changes. Are you sure you want to go back?</Text>
            <View style={st.modalActions}>
              <TouchableOpacity style={st.modalBtnSecondary} onPress={() => setShowDiscardModal(false)} activeOpacity={0.7}>
                <Text style={st.modalBtnSecondaryText}>Keep Editing</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.modalBtnDanger} onPress={() => { setShowDiscardModal(false); navigation.goBack(); }} activeOpacity={0.7}>
                <Text style={st.modalBtnDangerText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 8 : 8, paddingBottom: 12,
  },
  topBarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: DS.bgSurface2, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 17, fontWeight: "600", color: DS.textPrimary },

  // Avatar
  avatarSection: { alignItems: "center", paddingVertical: 24 },
  avatarWrapper: { position: "relative", width: 96, height: 96 },
  avatarOuter: { width: 96, height: 96, borderRadius: 48, overflow: "hidden" },
  avatarCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: DS.brandNavy, alignItems: "center", justifyContent: "center",
  },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarText: { fontSize: 36, fontWeight: "700", color: DS.textInverse },
  editBadge: {
    position: "absolute", bottom: 0, right: -2,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: DS.accentGold, alignItems: "center", justifyContent: "center",
    borderWidth: 2.5, borderColor: DS.bgPage,
  },

  // Section
  sectionLabel: {
    fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase",
    marginBottom: 8, marginLeft: 4, color: DS.textSecondary,
  },
  card: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4, borderWidth: 1, marginBottom: 24,
    backgroundColor: DS.bgSurface, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 2 },
    }),
  },

  // Fields
  fieldRow: { paddingVertical: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "500", marginBottom: 8, marginLeft: 2, color: DS.textSecondary },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  inputContainer: {
    flexDirection: "row", alignItems: "center", height: 50, borderRadius: 14,
    paddingHorizontal: 16, borderWidth: 1, backgroundColor: DS.bgSurface2, borderColor: DS.border,
  },
  input: { flex: 1, fontSize: 15, fontWeight: "500", color: DS.textPrimary, padding: 0 },
  optionalBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: DS.accentGoldSub },
  optionalText: { fontSize: 10, fontWeight: "600", color: DS.accentGold },
  emailHint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginLeft: 2 },
  emailHintText: { fontSize: 12, fontWeight: "400", color: DS.brandBlue },

  // Save
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 54, borderRadius: 999, gap: 8, backgroundColor: DS.brandNavy,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },
  saveBtnText: { fontSize: 15, fontWeight: "600", color: DS.textInverse },

  // Photo Preview
  previewOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center", alignItems: "center",
  },
  previewClose: {
    position: "absolute", top: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 12 : 56,
    right: 20, width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
    zIndex: 10,
  },
  previewImage: {
    width: SCREEN_WIDTH - 48, height: SCREEN_WIDTH - 48, borderRadius: 20,
  },
  previewActions: {
    position: "absolute", bottom: Platform.OS === "ios" ? 50 : 32,
    flexDirection: "row", gap: 16,
  },
  previewActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  previewDeleteBtn: {
    backgroundColor: "rgba(200,64,42,0.12)",
  },
  previewActionText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },

  // Modals
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 32 },
  modalContent: { width: "100%", borderRadius: 24, padding: 28, alignItems: "center", backgroundColor: DS.bgSurface },
  modalIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8, color: DS.textPrimary },
  modalMessage: { fontSize: 14, fontWeight: "400", textAlign: "center", lineHeight: 20, marginBottom: 24, color: DS.textSecondary },
  modalActions: { flexDirection: "row", gap: 12, width: "100%" },
  modalBtnFull: { width: "100%", height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DS.brandNavy },
  modalBtnText: { fontSize: 15, fontWeight: "600", color: DS.textInverse },
  modalBtnSecondary: { flex: 1, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DS.bgSurface2 },
  modalBtnSecondaryText: { fontSize: 15, fontWeight: "600", color: DS.textPrimary },
  modalBtnDanger: { flex: 1, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: DS.negative },
  modalBtnDangerText: { fontSize: 15, fontWeight: "600", color: DS.textInverse },
  successCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: DS.positive, alignItems: "center", justifyContent: "center", marginBottom: 16 },
});