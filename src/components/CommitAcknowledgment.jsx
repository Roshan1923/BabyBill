/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Easing,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DS = {
  bgSurface:   '#FFFEFB',
  brandNavy:    '#1A3A6B',
  accentGold:   '#E8A020',
  accentGoldSub:'#FEF3DC',
  textPrimary:  '#1C1610',
  textSecondary:'#8A7E72',
  positive:     '#2A8C5C',
  positiveSub:  '#E8F5EE',
  border:       '#EDE8E0',
};

/**
 * CommitAcknowledgment
 *
 * Renders a bottom-up slide card that celebrates the scan commit.
 * Auto-dismisses and calls onComplete after the animation finishes.
 *
 * Props:
 *   scanCount  — number of scans captured
 *   onComplete — called when animation finishes, navigate to Pending
 */
export default function CommitAcknowledgment({ scanCount = 1, onComplete }) {
  const slideY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const subTextOpacity = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sequence = Animated.sequence([
      // ── 1. Slide card up + fade backdrop (0–300ms) ──
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 14,
          bounciness: 6,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),

      // ── 2. Checkmark pops in (300–500ms) ──
      Animated.parallel([
        Animated.spring(checkScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 16,
          bounciness: 14,
        }),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),

      // ── 3. Title text fades in (500–650ms) ──
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),

      // Brief hold
      Animated.delay(300),

      // ── 4. Subtitle "Processing started" fades in (950–1100ms) ──
      Animated.parallel([
        Animated.timing(subTextOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        // Pulse the dots
        Animated.loop(
          Animated.sequence([
            Animated.timing(dotPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(dotPulse, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          ]),
          { iterations: 2 }
        ),
      ]),

      // Hold for a moment
      Animated.delay(500),

      // ── 5. Slide back down + fade out (1600–1900ms) ──
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.in(Easing.cubic),
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
    ]);

    sequence.start(() => {
      if (onComplete) onComplete();
    });
  }, []);

  const dotOpacity = dotPulse.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.3, 0.3, 1],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Subtle backdrop dim */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(0,0,0,0.3)', opacity: backdropOpacity },
        ]}
      />

      {/* Slide-up card */}
      <Animated.View
        style={[
          styles.cardContainer,
          { transform: [{ translateY: slideY }] },
        ]}
      >
        <View style={styles.card}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Checkmark circle */}
          <Animated.View
            style={[
              styles.checkCircle,
              {
                opacity: checkOpacity,
                transform: [{ scale: checkScale }],
              },
            ]}
          >
            <Ionicons name="checkmark" size={32} color={DS.positive} />
          </Animated.View>

          {/* Title */}
          <Animated.Text style={[styles.title, { opacity: textOpacity }]}>
            {scanCount} {scanCount === 1 ? 'scan' : 'scans'} captured
          </Animated.Text>

          {/* Subtitle with animated dots */}
          <Animated.View style={[styles.subRow, { opacity: subTextOpacity }]}>
            <Text style={styles.subtitle}>Processing started</Text>
            <Animated.Text style={[styles.dots, { opacity: dotOpacity }]}>
              {' '}···
            </Animated.Text>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: DS.bgSurface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 50 : 36,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: DS.border,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(26,58,107,0.15)',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 1,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
    }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: DS.border,
    marginBottom: 24,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DS.positiveSub,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: DS.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: DS.textSecondary,
  },
  dots: {
    fontSize: 15,
    fontWeight: '700',
    color: DS.accentGold,
  },
});