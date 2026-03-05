// CreditPill.jsx
// Drop this into your HomeScreen header beside the notification bell.
// Usage: <CreditPill credits={credits} onBuyNow={() => navigation.navigate('Paywall')} />

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Slider options ───────────────────────────────────────────────────────────
const TOPUP_OPTIONS = [0, 25, 50, 75, 100];

// ─── Helper: compute total displayable credits ────────────────────────────────
function getTotalCredits(credits) {
  if (!credits) return { remaining: 10, total: 10 };

  const { tier, is_active, free_remaining, sub_remaining, sub_limit, topup_remaining } = credits;

  if (is_active) {
    // Show sub credits + topup. Free is frozen.
    const remaining = sub_remaining + topup_remaining;
    const total = sub_limit + topup_remaining; // topup adds on top
    return { remaining, total: Math.max(total, sub_limit) };
  } else {
    // Free tier
    const remaining = free_remaining + topup_remaining;
    const total = 10 + topup_remaining;
    return { remaining, total };
  }
}

// ─── Low credit threshold ─────────────────────────────────────────────────────
function isLow(remaining, total) {
  if (total === 0) return false;
  return remaining / total <= 0.2 || remaining <= 3;
}

export default function CreditPill({ credits, onBuyNow }) {
  const [open, setOpen] = useState(false);
  const [pillLayout, setPillLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [selectedTopup, setSelectedTopup] = useState(25);
  const pillRef = useRef(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  const { remaining, total } = getTotalCredits(credits);
  const low = isLow(remaining, total);
  const pillColor = remaining === 0 ? '#E53935' : low ? '#E8A020' : '#1A3A6B';

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 280, friction: 22, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 130, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 130, useNativeDriver: true }),
      ]).start();
    }
  }, [open]);

  function handlePillPress() {
    pillRef.current?.measure((fx, fy, width, height, px, py) => {
      setPillLayout({ x: px, y: py, width, height });
      setOpen(true);
    });
  }

  function handleClose() {
    setOpen(false);
  }

  function handleBuyNow() {
    setOpen(false);
    onBuyNow && onBuyNow(selectedTopup);
  }

  // Popup left position — align to right edge of pill
  const popupWidth = 240;
  const popupLeft = Math.min(
    pillLayout.x + pillLayout.width - popupWidth,
    SCREEN_WIDTH - popupWidth - 16,
  );
  const popupTop = pillLayout.y + pillLayout.height + 8;

  return (
    <>
      {/* ── The pill itself ── */}
      <TouchableOpacity
        ref={pillRef}
        onPress={handlePillPress}
        activeOpacity={0.8}
        style={[styles.pill, { backgroundColor: pillColor }]}
      >
        <Ionicons name="flash" size={13} color="#FFFEFB" style={{ marginRight: 4 }} />
        <Text style={styles.pillText}>
          {remaining}/{total}
        </Text>
      </TouchableOpacity>

      {/* ── Popup modal ── */}
      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        {/* Blurred/greyed backdrop */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* Popup card */}
        <Animated.View
          style={[
            styles.popup,
            {
              left: popupLeft,
              top: popupTop,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          pointerEvents="box-none"
        >
          {/* ── Header ── */}
          <View style={styles.popupHeader}>
            <View>
              <Text style={styles.popupTitle}>Scan Credits</Text>
              <Text style={styles.popupSub}>
                {remaining} of {total} remaining
              </Text>
            </View>
            {low && remaining > 0 && (
              <View style={styles.lowBadge}>
                <Text style={styles.lowBadgeText}>Low</Text>
              </View>
            )}
            {remaining === 0 && (
              <View style={[styles.lowBadge, { backgroundColor: '#FDECEA' }]}>
                <Text style={[styles.lowBadgeText, { color: '#E53935' }]}>Empty</Text>
              </View>
            )}
          </View>

          {/* ── Usage bar ── */}
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${total > 0 ? (remaining / total) * 100 : 0}%`,
                  backgroundColor:
                    remaining === 0 ? '#E53935' : low ? '#E8A020' : '#1A3A6B',
                },
              ]}
            />
          </View>

          {/* ── Divider ── */}
          <View style={styles.divider} />

          {/* ── Add credits label ── */}
          <Text style={styles.addCreditsLabel}>Add Credits</Text>

          {/* ── Slider options ── */}
          <View style={styles.sliderRow}>
            {TOPUP_OPTIONS.map((val) => (
              <TouchableOpacity
                key={val}
                onPress={() => setSelectedTopup(val)}
                style={[
                  styles.sliderChip,
                  selectedTopup === val && styles.sliderChipActive,
                  val === 0 && styles.sliderChipZero,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sliderChipText,
                    selectedTopup === val && styles.sliderChipTextActive,
                    val === 0 && styles.sliderChipTextZero,
                  ]}
                >
                  {val === 0 ? '✕' : `+${val}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Buy Now button ── */}
          <TouchableOpacity
            onPress={handleBuyNow}
            activeOpacity={0.85}
            style={[
              styles.buyBtn,
              selectedTopup === 0 && styles.buyBtnDisabled,
            ]}
            disabled={selectedTopup === 0}
          >
            <Ionicons name="flash" size={14} color="#FFFEFB" style={{ marginRight: 6 }} />
            <Text style={styles.buyBtnText}>
              {selectedTopup === 0 ? 'Select an amount' : `Buy +${selectedTopup} Credits`}
            </Text>
          </TouchableOpacity>

          {/* ── View Plans link ── */}
          <TouchableOpacity
            onPress={() => { handleClose(); onBuyNow && onBuyNow('plans'); }}
            style={styles.plansLink}
            activeOpacity={0.7}
          >
            <Text style={styles.plansLinkText}>View subscription plans</Text>
            <Ionicons name="chevron-forward" size={12} color="#1A3A6B" />
          </TouchableOpacity>

          {/* ── Caret / arrow pointing up ── */}
          <View style={[styles.caret, { right: popupWidth - (pillLayout.x + pillLayout.width - popupLeft) + pillLayout.width / 2 - 6 }]} />
        </Animated.View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  pillText: {
    color: '#FFFEFB',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  // Popup
  popup: {
    position: 'absolute',
    width: 240,
    backgroundColor: '#FFFEFB',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#1A3A6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
    transformOrigin: 'top right',
  },
  caret: {
    position: 'absolute',
    top: -7,
    width: 12,
    height: 12,
    backgroundColor: '#FFFEFB',
    transform: [{ rotate: '45deg' }],
    borderTopLeftRadius: 2,
    shadowColor: '#1A3A6B',
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },

  popupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  popupTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
    color: '#1A3A6B',
    letterSpacing: 0.1,
  },
  popupSub: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#8896A8',
    marginTop: 1,
  },
  lowBadge: {
    backgroundColor: '#FFF8EC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lowBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
    color: '#E8A020',
  },

  // Usage bar
  barTrack: {
    height: 5,
    backgroundColor: '#EEF0F3',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 14,
  },
  barFill: {
    height: '100%',
    borderRadius: 10,
  },

  divider: {
    height: 1,
    backgroundColor: '#F0F0ED',
    marginBottom: 12,
  },

  // Add credits
  addCreditsLabel: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
    color: '#8896A8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // Slider chips
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 4,
  },
  sliderChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F5F4F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderChipActive: {
    backgroundColor: '#1A3A6B',
  },
  sliderChipZero: {
    backgroundColor: '#F5F4F0',
    flex: 0,
    width: 32,
  },
  sliderChipText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
    color: '#1A3A6B',
  },
  sliderChipTextActive: {
    color: '#FFFEFB',
  },
  sliderChipTextZero: {
    color: '#B0B8C4',
    fontSize: 13,
  },

  // Buy button
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8A020',
    borderRadius: 12,
    paddingVertical: 11,
    marginBottom: 10,
  },
  buyBtnDisabled: {
    backgroundColor: '#D0D4DA',
  },
  buyBtnText: {
    color: '#FFFEFB',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // Plans link
  plansLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  plansLinkText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    fontWeight: '500',
    color: '#1A3A6B',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
});