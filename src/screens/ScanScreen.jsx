/* eslint-disable react-native/no-inline-styles */
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Image,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  requestPermissionWithBlockedHandling,
  openAppSettings,
} from '../utils/permissions';
import { useScanQueue } from '../context/ScanContext';
import { useProcessing } from '../context/ProcessingContext';
import PreviewOverlay from '../components/PreviewOverlay';
import ScanCompleteSheet from '../components/ScanCompleteSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Design System Tokens ────────────────────────────────────
const DS = {
  bgPage:        '#FAF8F4',
  bgSurface:     '#FFFEFB',
  bgSurface2:    '#F5F2EC',
  brandNavy:     '#1A3A6B',
  accentGold:    '#E8A020',
  accentGoldSub: '#FEF3DC',
  textPrimary:   '#1C1610',
  textSecondary: '#8A7E72',
  textInverse:   '#FFFEFB',
  positive:      '#2A8C5C',
  negative:      '#C8402A',
  border:        '#EDE8E0',
  shadow:        'rgba(26,58,107,0.10)',
};

// Frosted overlay colors for camera UI
const OVERLAY = {
  pill:       'rgba(15, 15, 15, 0.55)',
  pillBorder: 'rgba(255, 255, 255, 0.12)',
  btnBg:      'rgba(15, 15, 15, 0.5)',
  btnBorder:  'rgba(255, 255, 255, 0.15)',
  white80:    'rgba(255, 255, 255, 0.8)',
  white50:    'rgba(255, 255, 255, 0.5)',
  white30:    'rgba(255, 255, 255, 0.3)',
};

export default function ScanScreen({ navigation }) {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef(null);
  const { scans, addScan, clearScans } = useScanQueue();
  const { processBatch } = useProcessing();

  const hasScans = scans.length > 0;

  const [flash, setFlash] = useState('off');
  const [zoom, setZoom] = useState(1);
  const [focusPoint, setFocusPoint] = useState(null);
  const [capturing, setCapturing] = useState(false);

  // Preview overlay state — photo shows as overlay on top of camera
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Commit acknowledgment animation state
  const [showCommit, setShowCommit] = useState(false);
  const [committedScans, setCommittedScans] = useState([]);

  // Modals
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showSettingsBtn, setShowSettingsBtn] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Animations
  const focusAnim = useRef(new Animated.Value(0)).current;
  const captureScale = useRef(new Animated.Value(1)).current;
  const zoomIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;

  // Best format
  const format = useMemo(() => {
    if (!device) return null;
    const formats = device.formats ?? [];
    if (formats.length === 0) return null;
    const maxPhotoRes = Math.max(
      ...formats.map((f) => (f.photoWidth ?? 0) * (f.photoHeight ?? 0))
    );
    const topPhotoFormats = formats.filter(
      (f) => (f.photoWidth ?? 0) * (f.photoHeight ?? 0) === maxPhotoRes
    );
    const best = [...topPhotoFormats].sort((a, b) => {
      const aVideo = (a.videoWidth ?? 0) * (a.videoHeight ?? 0);
      const bVideo = (b.videoWidth ?? 0) * (b.videoHeight ?? 0);
      return bVideo - aVideo;
    })[0];
    return best ?? null;
  }, [device]);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Pulse the badge when scan count changes
  useEffect(() => {
    if (hasScans) {
      badgePulse.setValue(1.3);
      Animated.spring(badgePulse, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 12,
      }).start();
    }
  }, [scans.length]);

  const showError = useCallback((title, message, settingsBtn = false) => {
    setErrorTitle(title);
    setErrorMessage(message);
    setShowSettingsBtn(settingsBtn);
    setShowErrorModal(true);
  }, []);

  // ─── Tap to focus ──────────────────────────────────────────
  const handleTapToFocus = async (event) => {
    if (!cameraRef.current || previewPhoto) return;
    try {
      const x = event.nativeEvent.locationX;
      const y = event.nativeEvent.locationY;
      setFocusPoint({ x, y });

      focusAnim.setValue(0);
      Animated.sequence([
        Animated.spring(focusAnim, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 8 }),
        Animated.delay(600),
        Animated.timing(focusAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setFocusPoint(null));

      await cameraRef.current.focus({ x, y });
    } catch (e) {
      console.log('Focus error:', e);
    }
  };

  // ─── Capture → show overlay (no navigation) ───────────────
  const handleCapture = async () => {
    if (!cameraRef.current || capturing || previewPhoto) return;
    setCapturing(true);

    Animated.sequence([
      Animated.timing(captureScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(captureScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }),
    ]).start();

    try {
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'quality',
        flash: flash,
        enableShutterSound: true,
        enableAutoRedEyeReduction: true,
        enableAutoStabilization: true,
      });
      // Show preview overlay — camera stays live underneath
      setPreviewPhoto(photo.path);
    } catch (error) {
      showError('Capture Failed', 'Something went wrong while taking the photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  // ─── Preview overlay callbacks ─────────────────────────────
  const handlePreviewKeep = useCallback(({ photoPath, rotation }) => {
    addScan({ photoPath, rotation });
    setPreviewPhoto(null); // Dismiss overlay → camera visible with updated thumbnail
  }, [addScan]);

  const handlePreviewRetake = useCallback(() => {
    setPreviewPhoto(null); // Dismiss overlay → camera ready for another shot
  }, []);

  // ─── Flash toggle ──────────────────────────────────────────
  const toggleFlash = () => {
    setFlash((c) => (c === 'off' ? 'on' : 'off'));
  };

  // ─── Zoom ──────────────────────────────────────────────────
  const handleZoom = (level) => {
    setZoom(level);
    zoomIndicatorOpacity.setValue(1);
    Animated.timing(zoomIndicatorOpacity, {
      toValue: 0, duration: 1200, delay: 400, useNativeDriver: true,
    }).start();
  };

  // ─── Gallery — multi-select supported ──────────────────────
  const handleGallery = async () => {
    const granted = await requestPermissionWithBlockedHandling(
      'photoLibrary',
      ({ title, message, showSettingsButton }) => {
        showError(title, message, showSettingsButton);
      }
    );
    if (!granted) return;

    launchImageLibrary(
      { mediaType: 'photo', quality: 1, selectionLimit: 0 },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          showError('Gallery Error', response.errorMessage || 'Failed to pick image.');
          return;
        }
        const assets = response.assets;
        if (!assets || assets.length === 0) return;

        if (assets.length === 1) {
          // Single photo — show preview overlay for keep/retake
          const uri = assets[0].uri;
          const path = uri.replace('file://', '');
          setPreviewPhoto(path);
        } else {
          // Multiple photos — skip preview, send all directly to processing
          const batch = assets.map((asset, index) => ({
            id: `gallery_${Date.now()}_${index}`,
            photoPath: asset.uri.startsWith('file://')
              ? asset.uri.replace('file://', '')
              : asset.uri,
          }));

          setCommittedScans(batch);
          setShowCommit(true);
          processBatch(batch);
        }
      }
    );
  };

  // ─── Close / Cancel ────────────────────────────────────────
  const handleClose = () => {
    if (hasScans) {
      setShowDiscardModal(true);
    } else {
      navigation.navigate('Home');
    }
  };

  const handleDiscard = () => {
    clearScans();
    setShowDiscardModal(false);
    navigation.navigate('Home');
  };

  // ─── Done — show completion sheet & start processing ────────
  const handleDone = () => {
    const batch = [...scans]; // Snapshot before clearing
    setCommittedScans(batch);
    setShowCommit(true);

    // Start background processing immediately
    processBatch(batch);
  };

  const handleViewProgress = () => {
    setShowCommit(false);
    clearScans();
    navigation.navigate('Main', { screen: 'Receipts', params: { tab: 'review' } });
  };

  const handleDismissSheet = () => {
    setShowCommit(false);
    clearScans();
    // Stay on camera — user wants to scan more
  };

  // ─── Thumbnail tap — gallery of captures ───────────────────
  const handleThumbnailTap = () => {
    navigation.navigate('ScanGallery');
  };

  // Focus animation values
  const focusScale = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [1.4, 1] });
  const focusOpacity = focusAnim;

  const zoomLevels = [0.5, 1, 2, 3];

  // ─── Permission Screen ─────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.permissionScreen}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconCircle}>
            <Ionicons name="camera-outline" size={36} color={DS.brandNavy} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionSubtitle}>
            BillBrain needs camera access to scan your receipts and bills
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.8}>
            <Ionicons name="shield-checkmark-outline" size={18} color={DS.textInverse} />
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.permissionBackBtn} onPress={() => navigation.goBack()} activeOpacity={0.6}>
            <Text style={styles.permissionBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── No Camera ─────────────────────────────────────────────
  if (!device) {
    return (
      <View style={styles.permissionScreen}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.permissionCard}>
          <View style={[styles.permissionIconCircle, { backgroundColor: '#FDF2EF' }]}>
            <Ionicons name="alert-circle-outline" size={36} color={DS.negative} />
          </View>
          <Text style={styles.permissionTitle}>No Camera Found</Text>
          <Text style={styles.permissionSubtitle}>We couldn't detect a camera on this device</Text>
          <TouchableOpacity
            style={[styles.permissionBtn, { backgroundColor: DS.textSecondary }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.permissionBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Main Camera UI ────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Live camera — always mounted ── */}
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
        format={format}
        zoom={zoom}
        enableZoomGesture={false}
        photoHdr={device.supportsPhotoHdr || false}
        lowLightBoost={device.supportsLowLightBoost || false}
        resizeMode="cover"
        onTouchEnd={handleTapToFocus}
      />

      {/* ── Focus Indicator ── */}
      {focusPoint && !previewPhoto && (
        <Animated.View
          style={[
            styles.focusRing,
            {
              left: focusPoint.x - 32,
              top: focusPoint.y - 32,
              opacity: focusOpacity,
              transform: [{ scale: focusScale }],
            },
          ]}
        >
          <View style={styles.focusCornerTL} />
          <View style={styles.focusCornerTR} />
          <View style={styles.focusCornerBL} />
          <View style={styles.focusCornerBR} />
        </Animated.View>
      )}

      {/* ── Floating Zoom Indicator ── */}
      {!previewPhoto && (
        <Animated.View style={[styles.zoomBadge, { opacity: zoomIndicatorOpacity }]}>
          <Ionicons name="search-outline" size={14} color="#fff" />
          <Text style={styles.zoomBadgeText}>{zoom}x</Text>
        </Animated.View>
      )}

      {/* ── Camera Controls (hidden when preview overlay is showing) ── */}
      {!previewPhoto && (
        <>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.topBtn} onPress={handleClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>

            {/* Done button — only in accumulation state */}
            {hasScans && (
              <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.7}>
                <Ionicons name="checkmark" size={22} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            {/* Zoom selector */}
            <View style={styles.zoomRow}>
              {zoomLevels.map((level) => {
                const isActive = zoom === level;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[styles.zoomBtn, isActive && styles.zoomBtnActive]}
                    onPress={() => handleZoom(level)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.zoomText, isActive && styles.zoomTextActive]}>
                      {level === 0.5 ? '.5' : level}x
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Capture row */}
            <View style={styles.captureRow}>

              {/* Left: Gallery (fresh) or Thumbnail stack (accumulation) */}
              {hasScans ? (
                <TouchableOpacity style={styles.thumbnailWrap} onPress={handleThumbnailTap} activeOpacity={0.7}>
                  {/* 3rd card back */}
                  {scans.length > 2 && (
                    <View style={[styles.stackCard, styles.stackCard3]}>
                      <Image
                        source={{ uri: 'file://' + scans[scans.length - 3].photoPath }}
                        style={styles.stackCardImage}
                      />
                    </View>
                  )}
                  {/* 2nd card back */}
                  {scans.length > 1 && (
                    <View style={[styles.stackCard, styles.stackCard2]}>
                      <Image
                        source={{ uri: 'file://' + scans[scans.length - 2].photoPath }}
                        style={styles.stackCardImage}
                      />
                    </View>
                  )}
                  {/* Top card */}
                  <Animated.View style={[styles.stackCardTop, { transform: [{ scale: badgePulse }] }]}>
                    <Image
                      source={{ uri: 'file://' + scans[scans.length - 1].photoPath }}
                      style={styles.stackCardImage}
                    />
                  </Animated.View>
                  {/* Badge */}
                  <Animated.View style={[styles.countBadge, { transform: [{ scale: badgePulse }] }]}>
                    <Text style={styles.countBadgeText}>{scans.length}</Text>
                  </Animated.View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.sideBtn} onPress={handleGallery} activeOpacity={0.7}>
                  <Ionicons name="images" size={24} color="#fff" />
                </TouchableOpacity>
              )}

              {/* Capture button */}
              <TouchableOpacity
                style={styles.captureOuter}
                onPress={handleCapture}
                activeOpacity={1}
                disabled={capturing}
              >
                <Animated.View style={[styles.captureCircle, { transform: [{ scale: captureScale }] }]}>
                  <View style={styles.captureInner}>
                    {capturing && <View style={styles.capturingDot} />}
                  </View>
                </Animated.View>
              </TouchableOpacity>

              {/* Right: Flash */}
              <TouchableOpacity
                style={[styles.sideBtn, flash === 'on' && styles.sideBtnFlashOn]}
                onPress={toggleFlash}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={flash === 'on' ? 'flash' : 'flash-off'}
                  size={22}
                  color={flash === 'on' ? DS.accentGold : '#fff'}
                />
              </TouchableOpacity>
            </View>

            {/* Safe area spacer */}
            <View style={{ height: Platform.OS === 'ios' ? 28 : 16 }} />
          </View>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          PREVIEW OVERLAY — renders on top of live camera
          Camera stays mounted and visible during fly animation
         ══════════════════════════════════════════════════════ */}
      {previewPhoto && (
        <PreviewOverlay
          photoPath={previewPhoto}
          onKeep={handlePreviewKeep}
          onRetake={handlePreviewRetake}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          SCAN COMPLETE SHEET — bottom sheet after tapping Done
          or after multi-gallery upload
         ══════════════════════════════════════════════════════ */}
      {showCommit && (
        <ScanCompleteSheet
          scans={committedScans}
          onViewProgress={handleViewProgress}
          onDismiss={handleDismissSheet}
        />
      )}

      {/* ─── Discard Modal ─── */}
      <Modal visible={showDiscardModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="alert-circle" size={28} color={DS.negative} />
            </View>
            <Text style={styles.modalTitle}>Discard Scans?</Text>
            <Text style={styles.modalMessage}>
              You have {scans.length} unsaved scan{scans.length !== 1 ? 's' : ''}. They will be lost if you leave now.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowDiscardModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnSecondaryText}>Keep Scanning</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDestructive]}
                onPress={handleDiscard}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Error / Permission Modal ─── */}
      <Modal visible={showErrorModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[
              styles.modalIconCircle,
              showSettingsBtn && { backgroundColor: DS.accentGoldSub },
            ]}>
              <Ionicons
                name={showSettingsBtn ? 'settings-outline' : 'alert-circle'}
                size={28}
                color={showSettingsBtn ? DS.accentGold : DS.negative}
              />
            </View>
            <Text style={styles.modalTitle}>{errorTitle}</Text>
            <Text style={styles.modalMessage}>{errorMessage}</Text>
            {showSettingsBtn ? (
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                  onPress={() => setShowErrorModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={() => { setShowErrorModal(false); openAppSettings(); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="settings-outline" size={16} color={DS.textInverse} style={{ marginRight: 6 }} />
                  <Text style={styles.modalBtnText}>Settings</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => setShowErrorModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnText}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // ─── Permission / No Camera ──────────────────────────────
  permissionScreen: {
    flex: 1, backgroundColor: DS.bgPage, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  permissionCard: {
    backgroundColor: DS.bgSurface, borderRadius: 24, padding: 32, alignItems: 'center', width: '100%',
    borderWidth: 1, borderColor: DS.border,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 24 },
      android: { elevation: 4 },
    }),
  },
  permissionIconCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: DS.accentGoldSub,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: DS.textPrimary, marginBottom: 8, textAlign: 'center' },
  permissionSubtitle: { fontSize: 14, color: DS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  permissionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: DS.brandNavy, height: 50, borderRadius: 14, paddingHorizontal: 24, gap: 8, width: '100%',
  },
  permissionBtnText: { fontSize: 16, fontWeight: '600', color: DS.textInverse },
  permissionBackBtn: { marginTop: 16, paddingVertical: 8 },
  permissionBackText: { fontSize: 14, fontWeight: '500', color: DS.textSecondary },

  // ─── Focus Ring ──────────────────────────────────────────
  focusRing: { position: 'absolute', width: 64, height: 64 },
  focusCornerTL: {
    position: 'absolute', top: 0, left: 0, width: 16, height: 16,
    borderTopWidth: 2.5, borderLeftWidth: 2.5, borderColor: DS.accentGold, borderTopLeftRadius: 4,
  },
  focusCornerTR: {
    position: 'absolute', top: 0, right: 0, width: 16, height: 16,
    borderTopWidth: 2.5, borderRightWidth: 2.5, borderColor: DS.accentGold, borderTopRightRadius: 4,
  },
  focusCornerBL: {
    position: 'absolute', bottom: 0, left: 0, width: 16, height: 16,
    borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderColor: DS.accentGold, borderBottomLeftRadius: 4,
  },
  focusCornerBR: {
    position: 'absolute', bottom: 0, right: 0, width: 16, height: 16,
    borderBottomWidth: 2.5, borderRightWidth: 2.5, borderColor: DS.accentGold, borderBottomRightRadius: 4,
  },

  // ─── Floating Zoom Badge ─────────────────────────────────
  zoomBadge: {
    position: 'absolute', top: '45%', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: OVERLAY.pill, borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 14, gap: 6,
    borderWidth: 1, borderColor: OVERLAY.pillBorder,
  },
  zoomBadgeText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ─── Top Bar ─────────────────────────────────────────────
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20,
  },
  topBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: OVERLAY.btnBg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: OVERLAY.btnBorder,
  },
  doneBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: OVERLAY.btnBg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: OVERLAY.btnBg,
  },

  // ─── Bottom Controls ─────────────────────────────────────
  bottomControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 8,
  },

  // Zoom row
  zoomRow: {
    flexDirection: 'row', backgroundColor: OVERLAY.pill, borderRadius: 24, padding: 3,
    marginBottom: 28, borderWidth: 1, borderColor: OVERLAY.pillBorder,
  },
  zoomBtn: {
    width: 42, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginHorizontal: 1,
  },
  zoomBtnActive: { backgroundColor: DS.accentGold },
  zoomText: { color: OVERLAY.white80, fontSize: 13, fontWeight: '600' },
  zoomTextActive: { color: '#000', fontWeight: '700' },

  // Capture row
  captureRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 44,
  },

  // Side buttons
  sideBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: OVERLAY.btnBg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: OVERLAY.btnBorder,
  },
  sideBtnFlashOn: {
    backgroundColor: 'rgba(232, 160, 32, 0.18)',
    borderColor: 'rgba(232, 160, 32, 0.35)',
  },

  // Thumbnail stack (accumulation state)
  thumbnailWrap: {
    width: 66, height: 66,
  },
  stackCard: {
    position: 'absolute',
    width: 52, height: 52, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: '#222',
  },
  stackCard3: {
    bottom: 0, left: 0,
    opacity: 0.4,
  },
  stackCard2: {
    bottom: 4, left: 3,
    opacity: 0.7,
  },
  stackCardTop: {
    position: 'absolute',
    bottom: 8, left: 6,
    width: 52, height: 52, borderRadius: 12, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: '#000',
  },
  stackCardImage: {
    width: '100%', height: '100%',
  },
  countBadge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: DS.accentGold,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2, borderColor: 'rgba(0,0,0,0.8)',
  },
  countBadgeText: {
    fontSize: 11, fontWeight: '800', color: '#fff',
  },

  // Capture button
  captureOuter: { padding: 4 },
  captureCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: OVERLAY.white30, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  captureInner: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  capturingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: DS.negative },

  // ─── Modals ──────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: DS.bgSurface, borderRadius: 24, padding: 28,
    alignItems: 'center', width: '100%', maxWidth: 340,
    borderWidth: 1, borderColor: DS.border,
  },
  modalIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#FDF2EF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: DS.textPrimary, marginBottom: 8, textAlign: 'center' },
  modalMessage: { fontSize: 14, color: DS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  modalBtn: {
    flex: 1, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  },
  modalBtnPrimary: { backgroundColor: DS.brandNavy },
  modalBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: DS.border },
  modalBtnDestructive: { backgroundColor: DS.negative },
  modalBtnSecondaryText: { fontSize: 16, fontWeight: '600', color: DS.textSecondary },
  modalBtnText: { fontSize: 16, fontWeight: '600', color: DS.textInverse },
});