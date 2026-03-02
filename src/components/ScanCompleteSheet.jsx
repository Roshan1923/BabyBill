/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.45;

const DS = {
  bgSurface:     '#FFFEFB',
  brandNavy:     '#1A3A6B',
  accentGold:    '#E8A020',
  accentGoldSub: '#FEF3DC',
  textPrimary:   '#1C1610',
  textSecondary: '#8A7E72',
  textInverse:   '#FFFEFB',
  border:        '#EDE8E0',
  positive:      '#2A8C5C',
  positiveSub:   '#E8F5EE',
};

export default function ScanCompleteSheet({ scans = [], onViewProgress, onDismiss }) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const btnSlide = useRef(new Animated.Value(30)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const thumbAnims = useRef(scans.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Backdrop fade
    Animated.timing(backdropAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    // Sheet slides up
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: 6,
      delay: 50,
    }).start();

    // Check icon pops in
    Animated.spring(checkScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 12,
      bounciness: 14,
      delay: 200,
    }).start();

    // Count number scales in
    Animated.spring(countAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 8,
      delay: 300,
    }).start();

    // Thumbnails stagger in
    scans.forEach((_, i) => {
      Animated.spring(thumbAnims[i] || new Animated.Value(0), {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 10,
        delay: 350 + (i * 80),
      }).start();
    });

    // Button slides in
    Animated.parallel([
      Animated.timing(btnSlide, {
        toValue: 0,
        duration: 300,
        delay: 450,
        useNativeDriver: true,
      }),
      Animated.timing(btnOpacity, {
        toValue: 1,
        duration: 250,
        delay: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleViewProgress = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT + 50,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onViewProgress?.();
    });
  };

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT + 50,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  const scanCount = scans.length;
  const previewScans = scans.slice(-4); // Show max 4 thumbnails

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(0,0,0,0.4)', opacity: backdropAnim },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleDismiss}
        />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Drag handle */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Top content group (so buttons can sit lower consistently) */}
          <View>
            {/* Success icon + count row */}
            <View style={styles.headerRow}>
              <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
                <Ionicons name="checkmark" size={24} color={DS.positive} />
              </Animated.View>

              <View style={styles.headerText}>
                <Animated.View style={{ transform: [{ scale: countAnim }] }}>
                  <Text style={styles.title}>
                    {scanCount} {scanCount === 1 ? 'Receipt' : 'Receipts'} Captured
                  </Text>
                </Animated.View>
                <Text style={styles.subtitle}>Processing has started</Text>
              </View>
            </View>

            {/* Thumbnail preview row */}
            <View style={styles.thumbRow}>
              {previewScans.map((scan, i) => (
                <Animated.View
                  key={scan.id || i}
                  style={[
                    styles.thumbCard,
                    {
                      transform: [{ scale: thumbAnims[i] || new Animated.Value(1) }],
                      zIndex: previewScans.length - i,
                    },
                  ]}
                >
                  <Image source={{ uri: 'file://' + scan.photoPath }} style={styles.thumbImage} />
                  <View style={styles.thumbProcessingDot}>
                    <View style={styles.pulseDot} />
                  </View>
                </Animated.View>
              ))}

              {scanCount > 4 && (
                <View style={styles.thumbMore}>
                  <Text style={styles.thumbMoreText}>+{scanCount - 4}</Text>
                </View>
              )}
            </View>

            {/* Processing hint */}
            <View style={styles.hintRow}>
              <Ionicons name="time-outline" size={14} color={DS.textSecondary} />
              <Text style={styles.hintText}>Usually takes 10–20 seconds per receipt</Text>
            </View>
          </View>

          {/* Action buttons (pinned to bottom via space-between) */}
          <Animated.View
            style={[
              styles.btnArea,
              { transform: [{ translateY: btnSlide }], opacity: btnOpacity },
            ]}
          >
            <TouchableOpacity style={styles.primaryBtn} onPress={handleViewProgress} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>View Progress</Text>
              <Ionicons name="arrow-forward" size={18} color={DS.textInverse} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={handleDismiss} activeOpacity={0.7}>
              <Text style={styles.secondaryBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: DS.bgSurface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.2)',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 1,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
    }),
  },

  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: DS.border,
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    justifyContent: 'space-between', // ✅ pins buttons lower consistently
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  checkCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DS.positiveSub,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: DS.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: DS.textSecondary,
    marginTop: 2,
  },

  // Thumbnails
  thumbRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  thumbCard: {
    width: 56,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F0EDE8',
    borderWidth: 1.5,
    borderColor: DS.border,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbProcessingDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DS.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  thumbMore: {
    width: 56,
    height: 72,
    borderRadius: 10,
    backgroundColor: DS.accentGoldSub,
    borderWidth: 1.5,
    borderColor: 'rgba(232,160,32,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbMoreText: {
    fontSize: 15,
    fontWeight: '700',
    color: DS.accentGold,
  },

  // Hint
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  hintText: {
    fontSize: 13,
    color: DS.textSecondary,
    fontWeight: '500',
  },

  // Buttons
  btnArea: {
    gap: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16, // ✅ a touch more comfortable
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DS.brandNavy,
    height: 50,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(26,58,107,0.25)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
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
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    marginTop: 2,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#C8402A',
  },
});