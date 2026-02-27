/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DS = {
  bgSurface:     '#FFFEFB',
  brandNavy:     '#1A3A6B',
  accentGold:    '#E8A020',
  accentGoldSub: '#FEF3DC',
  textPrimary:   '#1C1610',
  textSecondary: '#8A7E72',
  textInverse:   '#FFFEFB',
  positive:      '#2A8C5C',
  border:        '#EDE8E0',
};

export default function ScanConfirmOverlay({ scanCount, onViewProgress, onClose }) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(80)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkRotate = useRef(new Animated.Value(0)).current;
  const countScale = useRef(new Animated.Value(0.5)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance
    Animated.parallel([
      // Backdrop fade
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      // Card slides up
      Animated.spring(cardTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 8,
        delay: 50,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 200,
        delay: 50,
        useNativeDriver: true,
      }),
      // Check icon pops in
      Animated.spring(checkScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
        bounciness: 14,
        delay: 200,
      }),
      Animated.timing(checkRotate, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
      // Count number scales in
      Animated.spring(countScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 10,
        delay: 350,
      }),
    ]).start();

    // Subtle shimmer loop on the gold circle
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const checkRotateInterpolate = checkRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-30deg', '0deg'],
  });

  const shimmerOpacity = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.08, 0.2, 0.08],
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(0,0,0,0.65)', opacity: backdropOpacity },
        ]}
      />

      {/* Card */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }],
          },
        ]}
      >
        <View style={styles.card}>
          {/* Gold circle with check */}
          <View style={styles.iconArea}>
            {/* Shimmer ring */}
            <Animated.View style={[styles.shimmerRing, { opacity: shimmerOpacity }]} />

            <Animated.View
              style={[
                styles.checkCircle,
                {
                  transform: [
                    { scale: checkScale },
                    { rotate: checkRotateInterpolate },
                  ],
                },
              ]}
            >
              <Ionicons name="checkmark-sharp" size={28} color="#fff" />
            </Animated.View>
          </View>

          {/* Count */}
          <Animated.View style={{ transform: [{ scale: countScale }] }}>
            <Text style={styles.countText}>
              {scanCount} {scanCount === 1 ? 'Receipt' : 'Receipts'} Captured
            </Text>
          </Animated.View>

          <Text style={styles.subtitleText}>
            Processing has started. You can track{'\n'}progress in your pending receipts.
          </Text>

          {/* CTA */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onViewProgress}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>View Progress</Text>
            <Ionicons name="arrow-forward" size={18} color={DS.textInverse} />
          </TouchableOpacity>

          {/* Secondary */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onClose}
            activeOpacity={0.6}
          >
            <Text style={styles.secondaryBtnText}>Continue Scanning</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: DS.bgSurface,
    borderRadius: 28,
    paddingTop: 36,
    paddingBottom: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: DS.border,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(26,58,107,0.15)',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 1,
        shadowRadius: 32,
      },
      android: { elevation: 8 },
    }),
  },

  // Icon area
  iconArea: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmerRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: DS.accentGold,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DS.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(232,160,32,0.4)',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },

  // Text
  countText: {
    fontSize: 22,
    fontWeight: '700',
    color: DS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 14,
    fontWeight: '400',
    color: DS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DS.brandNavy,
    height: 52,
    borderRadius: 16,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(26,58,107,0.25)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: DS.textInverse,
  },
  secondaryBtn: {
    marginTop: 14,
    paddingVertical: 10,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.textSecondary,
  },
});