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
  Dimensions,
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useScanQueue } from '../context/ScanContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const OVERLAY = {
  btnBg:      'rgba(15, 15, 15, 0.5)',
  btnBorder:  'rgba(255, 255, 255, 0.15)',
  pillBg:     'rgba(15, 15, 15, 0.55)',
  pillBorder: 'rgba(255, 255, 255, 0.12)',
};

// Thumbnail target position (bottom-left of camera screen)
const THUMB_TARGET_X = 44 + 33;  // paddingHorizontal + half thumbnail width
const THUMB_TARGET_Y = SCREEN_HEIGHT - (Platform.OS === 'ios' ? 120 : 100);

export default function PreviewScreen({ route, navigation }) {
  const { photoPath } = route.params;
  const photoUri = 'file://' + photoPath;
  const { addScan } = useScanQueue();

  const [rotation, setRotation] = useState(0);
  const [flyingAway, setFlyingAway] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Fly animation
  const flyProgress = useRef(new Animated.Value(0)).current;
  const uiOpacity = useRef(new Animated.Value(1)).current;
  const bgOpacity = useRef(new Animated.Value(1)).current;

  const handleRotate = () => {
    if (flyingAway) return;
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

  const handleRetake = () => {
    if (flyingAway) return;
    navigation.goBack();
  };

  const handleKeep = () => {
    if (flyingAway) return;
    setFlyingAway(true);

    // Fade UI immediately
    Animated.timing(uiOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start();

    // Brighten background (simulate camera appearing behind)
    Animated.timing(bgOpacity, {
      toValue: 0.3,
      duration: 350,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();

    // Animate the image: scale down + move to thumbnail corner
    Animated.timing(flyProgress, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }).start(() => {
      addScan({ photoPath, rotation });
      navigation.goBack();
    });
  };

  // Derived animation values from flyProgress (0 → 1)
  const flyScale = flyProgress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.25, 0.12],
  });

  const flyTranslateX = flyProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(SCREEN_WIDTH / 2) + THUMB_TARGET_X],
  });

  const flyTranslateY = flyProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, THUMB_TARGET_Y - (SCREEN_HEIGHT / 2)],
  });

  // Add slight border radius effect by using a wrapper
  const flyBorderRadius = flyProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 8, 16],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Background that fades to simulate camera behind ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#000', opacity: bgOpacity },
        ]}
      />

      {/* ── Full bleed image with fly animation ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              { translateX: flyTranslateX },
              { translateY: flyTranslateY },
              { scale: flyScale },
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

      {/* ── Top gradient fade ── */}
      <Animated.View style={{ opacity: uiOpacity }} pointerEvents={flyingAway ? 'none' : 'auto'}>
        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.15)', 'transparent']}
          style={styles.topGradient}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ── Bottom gradient fade ── */}
      <Animated.View style={{ opacity: uiOpacity }} pointerEvents={flyingAway ? 'none' : 'auto'}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.5)']}
          style={styles.bottomGradient}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ── Top Bar: Retake & Keep ── */}
      <Animated.View style={[styles.topBar, { opacity: uiOpacity }]} pointerEvents={flyingAway ? 'none' : 'auto'}>
        <TouchableOpacity style={styles.topBtn} onPress={handleRetake} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.topBtn} onPress={handleKeep} activeOpacity={0.7}>
          <Ionicons name="checkmark" size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Bottom: Rotate pill ── */}
      <Animated.View style={[styles.bottomBar, { opacity: uiOpacity }]} pointerEvents={flyingAway ? 'none' : 'auto'}>
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
  container: { flex: 1, backgroundColor: '#1a1a1a' },

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