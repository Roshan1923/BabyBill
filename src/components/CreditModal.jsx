import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const DS = {
  bgSurface: '#FFFEFB',
  bgSurface2: '#F5F2EC',
  brandNavy: '#1A3A6B',
  accentGold: '#E8A020',
  accentGoldSub: '#FEF3DC',
  textPrimary: '#1C1610',
  textSecondary: '#8A7E72',
  textInverse: '#FFFEFB',
  positive: '#2A8C5C',
  negative: '#C8402A',
  border: '#EDE8E0',
};

// ─── MODAL TYPES ─────────────────────────────────────────────
// 'zero_credits'    — no credits left, nudge to paywall
// 'partial_credits' — not enough for full batch, offer partial process
// 'purchase_success'— subscription or top-up purchase succeeded
// 'purchase_error'  — purchase failed
// 'restore_success' — restore found purchases
// 'restore_empty'   — restore found nothing
// 'generic_error'   — general error

const MODAL_CONFIG = {
  zero_credits: {
    icon: 'flash-off-outline',
    iconColor: DS.negative,
    iconBg: '#FDF2EF',
    title: 'Out of Scan Credits',
    message: "You've used all your scan credits. Upgrade your plan or buy a credit pack to keep scanning.",
  },
  partial_credits: {
    icon: 'alert-circle-outline',
    iconColor: DS.accentGold,
    iconBg: DS.accentGoldSub,
    title: 'Not Enough Credits',
    // message is dynamic — set via props
  },
  purchase_success: {
    icon: 'checkmark-circle',
    iconColor: DS.positive,
    iconBg: '#E8F5EE',
    title: 'Purchase Successful!',
  },
  purchase_error: {
    icon: 'close-circle-outline',
    iconColor: DS.negative,
    iconBg: '#FDF2EF',
    title: 'Purchase Failed',
  },
  restore_success: {
    icon: 'checkmark-circle',
    iconColor: DS.positive,
    iconBg: '#E8F5EE',
    title: 'Purchases Restored',
  },
  restore_empty: {
    icon: 'search-outline',
    iconColor: DS.textSecondary,
    iconBg: DS.bgSurface2,
    title: 'No Purchases Found',
    message: "We couldn't find any previous purchases to restore.",
  },
  generic_error: {
    icon: 'alert-circle-outline',
    iconColor: DS.negative,
    iconBg: '#FDF2EF',
    title: 'Something Went Wrong',
  },
};

/**
 * CreditModal — styled modal that replaces Alert.alert for all credit/purchase flows
 *
 * Props:
 *   visible      — boolean
 *   type         — one of the MODAL_CONFIG keys
 *   message      — optional override message
 *   title        — optional override title
 *   buttons      — array of { text, onPress, style? ('primary'|'secondary'|'destructive'|'gold') }
 *   onClose      — called when backdrop tapped or modal dismissed
 *   extraContent — optional React node rendered between message and buttons
 */
export default function CreditModal({
  visible = false,
  type = 'generic_error',
  message,
  title,
  buttons = [],
  onClose,
  extraContent,
}) {
  const config = MODAL_CONFIG[type] || MODAL_CONFIG.generic_error;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 300,
          friction: 20,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 150, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      onClose?.();
    });
  };

  const getButtonStyle = (style) => {
    switch (style) {
      case 'primary': return { bg: DS.brandNavy, text: DS.textInverse };
      case 'gold': return { bg: DS.accentGold, text: DS.textInverse };
      case 'destructive': return { bg: DS.negative, text: DS.textInverse };
      case 'secondary':
      default: return { bg: 'transparent', text: DS.textPrimary, border: true };
    }
  };

  // Default close button if no buttons provided
  const modalButtons = buttons.length > 0 ? buttons : [
    { text: 'OK', onPress: handleClose, style: 'primary' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Prevent backdrop press from closing when tapping card */}
          <TouchableOpacity activeOpacity={1}>
            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
              <Ionicons name={config.icon} size={28} color={config.iconColor} />
            </View>

            {/* Title */}
            <Text style={styles.title}>{title || config.title}</Text>

            {/* Message */}
            {(message || config.message) && (
              <Text style={styles.message}>{message || config.message}</Text>
            )}

            {/* Extra content (e.g., credit count display) */}
            {extraContent}

            {/* Buttons */}
            <View style={[
              styles.buttonRow,
              modalButtons.length === 1 && styles.buttonRowSingle,
            ]}>
              {modalButtons.map((btn, index) => {
                const btnStyle = getButtonStyle(btn.style);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      modalButtons.length > 1 && { flex: 1 },
                      { backgroundColor: btnStyle.bg },
                      btnStyle.border && styles.buttonBorder,
                    ]}
                    onPress={() => {
                      btn.onPress?.();
                    }}
                    activeOpacity={0.8}
                  >
                    {btn.icon && (
                      <Ionicons
                        name={btn.icon}
                        size={16}
                        color={btnStyle.text}
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Text style={[
                      styles.buttonText,
                      { color: btnStyle.text },
                    ]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Convenience wrapper for credit-specific modals ──────────

/**
 * Helper to build the "partial credits" extra content
 * showing a visual breakdown of credits vs photos
 */
export function PartialCreditsInfo({ creditsLeft, photosCount }) {
  return (
    <View style={styles.partialInfo}>
      <View style={styles.partialRow}>
        <View style={styles.partialItem}>
          <Ionicons name="flash" size={16} color={DS.accentGold} />
          <Text style={styles.partialNum}>{creditsLeft}</Text>
          <Text style={styles.partialLabel}>credit{creditsLeft !== 1 ? 's' : ''} left</Text>
        </View>
        <View style={styles.partialDivider} />
        <View style={styles.partialItem}>
          <Ionicons name="images-outline" size={16} color={DS.brandNavy} />
          <Text style={styles.partialNum}>{photosCount}</Text>
          <Text style={styles.partialLabel}>photo{photosCount !== 1 ? 's' : ''}</Text>
        </View>
      </View>
      <Text style={styles.partialHint}>
        Only the first {creditsLeft} will be processed
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: DS.bgSurface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DS.border,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(26,58,107,0.2)',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 1,
        shadowRadius: 32,
      },
      android: { elevation: 12 },
    }),
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: DS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: DS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  buttonRowSingle: {
    justifyContent: 'center',
  },
  button: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonBorder: {
    borderWidth: 1.5,
    borderColor: DS.border,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Partial credits info
  partialInfo: {
    width: '100%',
    backgroundColor: DS.bgSurface2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  partialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  partialItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  partialDivider: {
    width: 1,
    height: 24,
    backgroundColor: DS.border,
    marginHorizontal: 12,
  },
  partialNum: {
    fontSize: 18,
    fontWeight: '800',
    color: DS.textPrimary,
  },
  partialLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: DS.textSecondary,
  },
  partialHint: {
    fontSize: 12,
    fontWeight: '500',
    color: DS.accentGold,
    textAlign: 'center',
    marginTop: 10,
  },
});