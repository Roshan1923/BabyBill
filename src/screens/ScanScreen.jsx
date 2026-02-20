/* eslint-disable react-native/no-inline-styles */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

export default function ScanScreen({ navigation }) {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef(null);

  const [flash, setFlash] = useState('off');
  const [zoom, setZoom] = useState(1);
  const [focusPoint, setFocusPoint] = useState(null);

  // Get best format (highest resolution)
  const format = useMemo(() => {
    if (!device) return null;
    const sortedFormats = [...device.formats].sort((a, b) => {
      return (b.photoWidth * b.photoHeight) - (a.photoWidth * a.photoHeight);
    });
    return sortedFormats[0];
  }, [device]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Tap to focus
  const handleTapToFocus = async (event) => {
    if (cameraRef.current) {
      try {
        const x = event.nativeEvent.locationX;
        const y = event.nativeEvent.locationY;
        setFocusPoint({ x, y });
        await cameraRef.current.focus({ x, y });
        setTimeout(() => setFocusPoint(null), 1000);
      } catch (error) {
        console.log('Focus error:', error);
      }
    }
  };

  // Capture photo with max quality
  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePhoto({
          qualityPrioritization: 'quality',
          flash: flash === 'on' ? 'on' : 'off',
          enableShutterSound: true,
          enableAutoRedEyeReduction: true,
          enableAutoStabilization: true,
        });
        console.log('Photo captured:', photo.width, 'x', photo.height);
        navigation.navigate('Preview', { photoPath: photo.path });
      } catch (error) {
        Alert.alert('Error', 'Failed to capture photo');
        console.log(error);
      }
    }
  };

  const toggleFlash = () => {
    setFlash(current => current === 'off' ? 'on' : 'off');
  };

  const handleGallery = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 1,
        maxWidth: 4000,
        maxHeight: 4000,
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Error', response.errorMessage || 'Failed to pick image');
          return;
        }
        if (response.assets && response.assets[0]) {
          const uri = response.assets[0].uri;
          // Remove file:// prefix if present since PreviewScreen adds it
          const path = uri.replace('file://', '');
          navigation.navigate('Preview', { photoPath: path });
        }
      }
    );
  };

  const zoomLevels = [1, 2, 3];

  // Permission not granted
  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Camera Permission Required</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No camera found
  if (!device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>No Camera Found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        onTouchEnd={handleTapToFocus}
      />

      {/* Focus indicator */}
      {focusPoint && (
        <View
          style={[
            styles.focusIndicator,
            { left: focusPoint.x - 30, top: focusPoint.y - 30 },
          ]}
        />
      )}

      {/* Top bar - close & flash */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.topBtnText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.topBtn} onPress={toggleFlash}>
          <Text style={styles.topBtnText}>⚡</Text>
          <View
            style={[
              styles.flashDot,
              { backgroundColor: flash === 'on' ? '#FFD700' : 'transparent' },
            ]}
          />
        </TouchableOpacity>
      </View>

      {/* Bottom - zoom & capture */}
      <View style={styles.bottomControls}>
        <View style={styles.zoomRow}>
          {zoomLevels.map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.zoomBtn, zoom === level && styles.zoomBtnActive]}
              onPress={() => setZoom(level)}
            >
              <Text style={[styles.zoomText, zoom === level && styles.zoomTextActive]}>
                {level}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.captureRow}>
          <TouchableOpacity style={styles.galleryBtn} onPress={handleGallery}>
            <Icon name="images-outline" size={26} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureCircle} onPress={handleCapture}>
            <View style={styles.captureInner} />
          </TouchableOpacity>

          <View style={{ width: 50 }} />
        </View>

        <View style={{ height: 20 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#030712', alignItems: 'center', justifyContent: 'center' },
  message: { fontSize: 18, color: '#fff', marginBottom: 20 },
  permissionBtn: { backgroundColor: '#3b82f6', padding: 15, borderRadius: 10 },
  permissionBtnText: { color: '#fff', fontSize: 16 },
  topBar: { position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  topBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  topBtnText: { color: '#fff', fontSize: 20 },
  flashDot: { position: 'absolute', bottom: 2, width: 8, height: 8, borderRadius: 4 },
  focusIndicator: { position: 'absolute', width: 60, height: 60, borderWidth: 2, borderColor: '#FFD700', borderRadius: 10 },
  bottomControls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 40, alignItems: 'center' },
  zoomRow: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 4, marginBottom: 30 },
  zoomBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, marginHorizontal: 2 },
  zoomBtnActive: { backgroundColor: '#FFD700' },
  zoomText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  zoomTextActive: { color: '#000' },
  captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 50 },
  galleryBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center'},
  captureCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#fff' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
});