/* eslint-disable react-native/no-inline-styles */
import React, { useMemo, useRef, useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const OVERLAY = {
  btnBg: 'rgba(15, 15, 15, 0.5)',
  btnBorder: 'rgba(255, 255, 255, 0.15)',
  pillBg: 'rgba(15, 15, 15, 0.55)',
  pillBorder: 'rgba(255, 255, 255, 0.12)',
};

/**
 * PreviewOverlay
 * - Shows captured photo full screen on top of ScanScreen (camera remains behind)
 * - On "Keep": animates the image into the left target (gallery/thumb slot), then calls onKeep(photoPath, rotation)
 *
 * Props:
 *  visible: boolean
 *  photoPath: string | null  (absolute file path, WITHOUT file://)
 *  targetCenter: { x: number, y: number } | null
 *  onRetake: () => void
 *  onKeep: ({ photoPath, rotation }) => void
 */
export default function PreviewOverlay({
  visible,
  photoPath,
  targetCenter,
  onRetake,
  onKeep,
}) {
  const photoUri = useMemo(() => (photoPath ? 'file://' + photoPath : null), [photoPath]);

  const [rotation, setRotation] = useState(0);
  const [flyingAway, setFlyingAway] = useState(false);

  // rotation anim
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // fly anim
  const flyProgress = useRef(new Animated.Value(0)).current;
  const uiOpacity = useRef(new Animated.Value(1)).current;

  // "cardify" trick (native driver doesn't animate borderRadius)
  const [rounded, setRounded] = useState(false);

  useEffect(() => {
    if (!visible) return;
    // reset whenever opened
    setRotation(0);
    setFlyingAway(false);
    setRounded(false);
    rotateAnim.setValue(0);
    spinAnim.setValue(0);
    flyProgress.setValue(0);
    uiOpacity.setValue(1);
  }, [visible, rotateAnim, spinAnim, flyProgress, uiOpacity]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: Array.from({ length: 20 }, (_, i) => i),
    outputRange: Array.from({ length: 20 }, (_, i) => `${i * 90}deg`),
  });

  const iconSpin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-90deg'],
  });

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

  const handleKeep = () => {
    if (flyingAway || !photoPath) return;

    setFlyingAway(true);

    // Fade UI quickly (Apple-like)
    Animated.timing(uiOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start();

    // Cardify midway
    setTimeout(() => setRounded(true), 180);

    // Pop then fly (Apple "physical" feel)
    flyProgress.setValue(0);
    Animated.sequence([
      Animated.timing(flyProgress, { toValue: 0.04, duration: 70, useNativeDriver: true }),
      Animated.timing(flyProgress, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onKeep?.({ photoPath, rotation });
    });
  };

  // compute target deltas (center of screen -> target center)
  const targetX = targetCenter?.x ?? 60;
  const targetY = targetCenter?.y ?? (SCREEN_HEIGHT - 120);

  const dx = targetX - SCREEN_WIDTH / 2;
  const dy = targetY - SCREEN_HEIGHT / 2;

  const flyScale = flyProgress.interpolate({
    inputRange: [0, 0.04, 1],
    outputRange: [1, 1.03, 0.12],
  });

  const flyTranslateX = flyProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dx],
  });

  const flyTranslateY = flyProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dy],
  });

  if (!visible || !photoUri) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* Full bleed image with fly animation */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: rounded ? 14 : 0,
              overflow: 'hidden',
              transform: [
                { translateX: flyTranslateX },
                { translateY: flyTranslateY },
                { scale: flyScale },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Animated.Image
            source={{ uri: photoUri }}
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ rotate: rotateInterpolate }] },
            ]}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Top gradient fade */}
        <Animated.View style={{ opacity: uiOpacity }} pointerEvents="none">
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.15)', 'transparent']}
            style={styles.topGradient}
          />
        </Animated.View>

        {/* Bottom gradient fade */}
        <Animated.View style={{ opacity: uiOpacity }} pointerEvents="none">
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.5)']}
            style={styles.bottomGradient}
          />
        </Animated.View>

        {/* Top Bar */}
        <Animated.View
          style={[styles.topBar, { opacity: uiOpacity }]}
          pointerEvents={flyingAway ? 'none' : 'auto'}
        >
          <TouchableOpacity style={styles.topBtn} onPress={onRetake} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.topBtn} onPress={handleKeep} activeOpacity={0.7}>
            <Ionicons name="checkmark" size={22} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* Bottom Rotate */}
        <Animated.View
          style={[styles.bottomBar, { opacity: uiOpacity }]}
          pointerEvents={flyingAway ? 'none' : 'auto'}
        >
          <TouchableOpacity style={styles.rotatePill} onPress={handleRotate} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ rotate: iconSpin }] }}>
              <Ionicons name="sync-outline" size={18} color="#fff" />
            </Animated.View>
            <Text style={styles.rotateText}>Rotate</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },

  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },

  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
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
  rotateText: { fontSize: 14, fontWeight: '600', color: 'rgba(255, 255, 255, 0.85)' },
});