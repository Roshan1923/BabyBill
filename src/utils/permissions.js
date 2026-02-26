/**
 * permissions.js
 * Centralized permission handling for BillBrain
 * Handles Camera, Photo Library, and Torch/Flash permissions
 */

import { Platform, Linking, Alert } from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  openSettings,
} from 'react-native-permissions';

// ─── Permission Keys ─────────────────────────────────────────

const PERMISSION_MAP = {
  camera: Platform.select({
    ios: PERMISSIONS.IOS.CAMERA,
    android: PERMISSIONS.ANDROID.CAMERA,
  }),
  photoLibrary: Platform.select({
    ios: PERMISSIONS.IOS.PHOTO_LIBRARY,
    android: Number(Platform.Version) >= 33
      ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
      : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
  }),
  microphone: Platform.select({
    ios: PERMISSIONS.IOS.MICROPHONE,
    android: PERMISSIONS.ANDROID.RECORD_AUDIO,
  }),
};

// ─── Check a single permission ───────────────────────────────

export async function checkPermission(type) {
  const permission = PERMISSION_MAP[type];
  if (!permission) {
    console.warn(`Unknown permission type: ${type}`);
    return false;
  }

  try {
    const result = await check(permission);
    return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
  } catch (error) {
    console.error(`Error checking ${type} permission:`, error);
    return false;
  }
}

// ─── Request a single permission ─────────────────────────────

export async function requestPermission(type) {
  const permission = PERMISSION_MAP[type];
  if (!permission) {
    console.warn(`Unknown permission type: ${type}`);
    return { granted: false, status: 'unknown' };
  }

  try {
    // First check current status
    const currentStatus = await check(permission);

    // Already granted
    if (currentStatus === RESULTS.GRANTED || currentStatus === RESULTS.LIMITED) {
      return { granted: true, status: currentStatus };
    }

    // Blocked — user previously denied, must go to Settings
    if (currentStatus === RESULTS.BLOCKED) {
      return { granted: false, status: 'blocked' };
    }

    // Unavailable on this device
    if (currentStatus === RESULTS.UNAVAILABLE) {
      return { granted: false, status: 'unavailable' };
    }

    // Request the permission
    const result = await request(permission);
    const granted = result === RESULTS.GRANTED || result === RESULTS.LIMITED;
    return { granted, status: result };
  } catch (error) {
    console.error(`Error requesting ${type} permission:`, error);
    return { granted: false, status: 'error' };
  }
}

// ─── Request multiple permissions at once ────────────────────

export async function requestMultiplePermissions(types) {
  const results = {};
  for (const type of types) {
    results[type] = await requestPermission(type);
  }
  return results;
}

// ─── Open device settings ────────────────────────────────────

export function openAppSettings() {
  openSettings().catch(() => {
    // Fallback for older versions
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    }
  });
}

// ─── Friendly permission names ───────────────────────────────

const PERMISSION_LABELS = {
  camera: 'Camera',
  photoLibrary: 'Photo Library',
  microphone: 'Microphone',
};

const PERMISSION_DESCRIPTIONS = {
  camera: 'BillBrain needs camera access to scan your receipts and bills.',
  photoLibrary: 'BillBrain needs photo library access so you can upload receipt photos.',
  microphone: 'BillBrain needs microphone access for video capture.',
};

// ─── Get user-friendly info for a permission ─────────────────

export function getPermissionInfo(type) {
  return {
    label: PERMISSION_LABELS[type] || type,
    description: PERMISSION_DESCRIPTIONS[type] || '',
  };
}

// ─── Helper: request with blocked handling ───────────────────
// Shows a prompt to go to Settings if permission was previously denied

export async function requestPermissionWithBlockedHandling(type, showModal) {
  const result = await requestPermission(type);

  if (result.granted) {
    return true;
  }

  if (result.status === 'blocked') {
    const info = getPermissionInfo(type);
    // Use the showModal callback so the caller can display their custom modal
    if (showModal) {
      showModal({
        title: `${info.label} Access Required`,
        message: `${info.description}\n\nPlease enable ${info.label.toLowerCase()} access in your device Settings.`,
        showSettingsButton: true,
      });
    }
    return false;
  }

  if (result.status === 'unavailable') {
    const info = getPermissionInfo(type);
    if (showModal) {
      showModal({
        title: `${info.label} Unavailable`,
        message: `${info.label} is not available on this device.`,
        showSettingsButton: false,
      });
    }
    return false;
  }

  // User denied (but not blocked yet — they can be asked again on Android)
  return false;
}

// ─── Info.plist keys needed (reference for developers) ───────
//
// Add these to your ios/BabyBillV2/Info.plist:
//
// <key>NSCameraUsageDescription</key>
// <string>BillBrain needs camera access to scan your receipts and bills</string>
//
// <key>NSPhotoLibraryUsageDescription</key>
// <string>BillBrain needs photo library access so you can upload receipt photos</string>
//
// <key>NSPhotoLibraryAddUsageDescription</key>
// <string>BillBrain needs to save scanned receipt photos to your library</string>
//
// <key>NSMicrophoneUsageDescription</key>
// <string>BillBrain needs microphone access for video capture</string>
//
// ─────────────────────────────────────────────────────────────

export default {
  checkPermission,
  requestPermission,
  requestMultiplePermissions,
  requestPermissionWithBlockedHandling,
  openAppSettings,
  getPermissionInfo,
};