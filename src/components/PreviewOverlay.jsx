/* eslint-disable react-native/no-inline-styles */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const OVERLAY = {
  btnBg:      'rgba(15, 15, 15, 0.5)',
  btnBorder:  'rgba(255, 255, 255, 0.15)',
  pillBg:     'rgba(15, 15, 15, 0.55)',
  pillBorder: 'rgba(255, 255, 255, 0.12)',
};

// Target: bottom-left thumbnail on camera (approximate)
const THUMB_X = 44 + 33;
const THUMB_Y = SCREEN_HEIGHT - (Platform.OS === 'ios' ? 120 : 100);

export default function PreviewOverlay({ photoPath, onKeep, onRetake }) {
  const photoUri = 'file://' + photoPath;

  const [rotation, setRotation] = useState(0);
  const [animating, setAnimating] = useState(false);

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // ─── Keep Scan animation values ────────────────────────────
  const overlayOpacity = useRef(new Animated.Value(1)).current;     // dims the dark bg
  const uiOpacity = useRef(new Animated.Value(1)).current;          // hides buttons/gradients
  const imageScale = useRef(new Animated.Value(1)).current;         // pop + fly scale
  const imageTranslateX = useRef(new Animated.Value(0)).current;
  const imageTranslateY = useRef(new Animated.Value(0)).current;
  const imageRotateZ = useRef(new Animated.Value(0)).current;       // slight tilt during fly
  const imageOpacity = useRef(new Animated.Value(1)).current;

  // ─── Rotate ────────────────────────────────────────────────
  const handleRotate = useCallback(() => {
    if (animating) return;
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
  }, [rotation, animating]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: Array.from({ length: 20 }, (_, i) => i),
    outputRange: Array.from({ length: 20 }, (_, i) => `${i * 90}deg`),
  });

  const iconSpin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-90deg'],
  });

  // Fly tilt interpolation
  const tiltInterpolate = imageRotateZ.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-3deg'],
  });

  // ─── Retake ────────────────────────────────────────────────
  const handleRetake = useCallback(() => {
    if (animating) return;
    onRetake();
  }, [animating, onRetake]);

  // ─── Keep Scan — 4-phase Apple Notes animation ─────────────
  const handleKeep = useCallback(() => {
    if (animating) return;
    setAnimating(true);

    const targetX = -(SCREEN_WIDTH / 2) + THUMB_X;
    const targetY = THUMB_Y - (SCREEN_HEIGHT / 2);

    // ── Phase 1: Pop (0–80ms) ──
    // Slight scale up for tap confirmation
    Animated.timing(imageScale, {
      toValue: 1.04,
      duration: 80,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start(() => {

      // ── Phase 2: Reveal camera (0–120ms, overlaps with phase 3) ──
      // Fade out the dark overlay so camera shows through
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start();

      // Fade out UI buttons immediately
      Animated.timing(uiOpacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();

      // ── Phase 3: Fly to target (120–320ms) ──
      // Scale down, translate to thumbnail, slight tilt
      Animated.parallel([
        Animated.timing(imageScale, {
          toValue: 0.13,
          duration: 320,
          useNativeDriver: true,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        }),
        Animated.timing(imageTranslateX, {
          toValue: targetX,
          duration: 320,
          useNativeDriver: true,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        }),
        Animated.timing(imageTranslateY, {
          toValue: targetY,
          duration: 320,
          useNativeDriver: true,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        }),
        Animated.timing(imageRotateZ, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start(() => {

        // ── Phase 4: Settle + bounce (last 80ms) ──
        Animated.sequence([
          Animated.timing(imageScale, {
            toValue: 0.10,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.spring(imageScale, {
            toValue: 0.12,
            useNativeDriver: true,
            speed: 40,
            bounciness: 15,
          }),
        ]).start(() => {
          // Fade out the clone
          Animated.timing(imageOpacity, {
            toValue: 0,
            duration: 60,
            useNativeDriver: true,
          }).start(() => {
            onKeep({ photoPath, rotation });
          });
        });
      });
    });
  }, [animating, photoPath, rotation, onKeep]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* ── Dark background overlay (fades to reveal camera) ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(0,0,0,0.92)', opacity: overlayOpacity },
        ]}
        pointerEvents={animating ? 'none' : 'auto'}
      />

      {/* ── Image with fly animation ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: imageOpacity,
            transform: [
              { translateX: imageTranslateX },
              { translateY: imageTranslateY },
              { scale: imageScale },
              { rotate: tiltInterpolate },
            ],
          },
        ]}
      >
        <Animated.Image
          source={{ uri: photoUri }}
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ rotate: rotateInterpolate }] },
          ]}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Top gradient ── */}
      <Animated.View
        style={[styles.topGradient, { opacity: uiOpacity }]}
        pointerEvents={animating ? 'none' : 'auto'}
      >
        <View style={styles.gradientInner} />
      </Animated.View>

      {/* ── Bottom gradient ── */}
      <Animated.View
        style={[styles.bottomGradient, { opacity: uiOpacity }]}
        pointerEvents={animating ? 'none' : 'auto'}
      >
        <View style={styles.gradientInnerBottom} />
      </Animated.View>

      {/* ── Top Bar: Retake & Keep ── */}
      <Animated.View
        style={[styles.topBar, { opacity: uiOpacity }]}
        pointerEvents={animating ? 'none' : 'auto'}
      >
        <TouchableOpacity style={styles.topBtn} onPress={handleRetake} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.topBtn} onPress={handleKeep} activeOpacity={0.7}>
          <Ionicons name="checkmark" size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Bottom: Rotate pill ── */}
      <Animated.View
        style={[styles.bottomBar, { opacity: uiOpacity }]}
        pointerEvents={animating ? 'none' : 'auto'}
      >
        <TouchableOpacity style={styles.rotatePill} onPress={handleRotate} activeOpacity={0.7}>
          <Animated.View style={{ transform: [{ rotate: iconSpin }] }}>
            <Ionicons name="sync-outline" size={18} color="#fff" />
          </Animated.View>
          <Text style={styles.rotateText}>Rotate</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Gradients (simple View-based since LinearGradient not needed in overlay)
  topGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 140,
  },
  gradientInner: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    opacity: 0.8,
  },
  bottomGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
  },
  gradientInnerBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    opacity: 0.8,
  },

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