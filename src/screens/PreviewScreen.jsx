/* eslint-disable react-native/no-inline-styles */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useScanQueue } from '../context/ScanContext';

// Frosted overlay — matches ScanScreen
const OVERLAY = {
  btnBg:      'rgba(15, 15, 15, 0.5)',
  btnBorder:  'rgba(255, 255, 255, 0.15)',
  pillBg:     'rgba(15, 15, 15, 0.55)',
  pillBorder: 'rgba(255, 255, 255, 0.12)',
};

export default function PreviewScreen({ route, navigation }) {
  const { photoPath } = route.params;
  const photoUri = 'file://' + photoPath;
  const { addScan } = useScanQueue();

  const [rotation, setRotation] = useState(0);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  const handleRotate = () => {
    const next = rotation + 90;
    setRotation(next);

    Animated.spring(rotateAnim, {
      toValue: next / 90,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();

    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: Array.from({ length: 20 }, (_, i) => i),
    outputRange: Array.from({ length: 20 }, (_, i) => `${i * 90}deg`),
  });

  const iconSpin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-90deg'],
  });

  const handleRetake = () => navigation.goBack();

  const handleKeep = () => {
    addScan({ photoPath, rotation });
    navigation.goBack(); // Back to camera — now in accumulation state
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Full bleed image ── */}
      <Animated.Image
        source={{ uri: photoUri }}
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate: rotateInterpolate }] },
        ]}
        resizeMode="contain"
      />

      {/* ── Top gradient fade ── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.15)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />

      {/* ── Bottom gradient fade ── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.5)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* ── Top Bar: Retake & Keep ── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={handleRetake} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.topBtn} onPress={handleKeep} activeOpacity={0.7}>
          <Ionicons name="checkmark" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Bottom: Rotate pill ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.rotatePill} onPress={handleRotate} activeOpacity={0.7}>
          <Animated.View style={{ transform: [{ rotate: iconSpin }] }}>
            <Ionicons name="sync-outline" size={18} color="#fff" />
          </Animated.View>
          <Text style={styles.rotateText}>Rotate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },

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

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  rotatePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: OVERLAY.pillBg,
    borderWidth: 1, borderColor: OVERLAY.pillBorder,
  },
  rotateText: {
    fontSize: 14, fontWeight: '600', color: 'rgba(255, 255, 255, 0.85)',
  },
});