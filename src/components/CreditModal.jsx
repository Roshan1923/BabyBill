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
          toValue: 1, tension: 300, friction: 20, useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1, duration: 200, useNativeDriver: true,
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
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <TouchableOpacity activeOpacity={1} style={styles.cardInner}>
            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
              <Ionicons name={config.icon} size={26} color={config.iconColor} />
            </View>

            {/* Title */}
            <Text style={styles.title}>{title || config.title}</Text>

            {/* Message */}
            {(message || config.message) ? (
              <Text style={styles.message}>{message || config.message}</Text>
            ) : null}

            {/* Extra content */}
            {extraContent ? extraContent : null}

            {/* Buttons */}
            <View style={styles.buttonRow}>
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
                    onPress={() => btn.onPress?.()}
                    activeOpacity={0.8}
                  >
                    {btn.icon && (
                      <Ionicons
                        name={btn.icon}
                        size={15}
                        color={btnStyle.text}
                        style={{ marginRight: 5 }}
                      />
                    )}
                    <Text style={[styles.buttonText, { color: btnStyle.text }]}>
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

export function PartialCreditsInfo({ creditsLeft, photosCount }) {
  return (
    <View style={styles.partialInfo}>
      <View style={styles.partialRow}>
        <View style={styles.partialItem}>
          <Ionicons name="flash" size={15} color={DS.accentGold} />
          <Text style={styles.partialNum}>{creditsLeft}</Text>
          <Text style={styles.partialLabel}>credit{creditsLeft !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.partialDivider} />
        <View style={styles.partialItem}>
          <Ionicons name="images-outline" size={15} color={DS.brandNavy} />
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: DS.bgSurface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: DS.border,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(26,58,107,0.18)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 28,
      },
      android: { elevation: 10 },
    }),
  },
  cardInner: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    width: '100%',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: DS.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: 13,
    fontWeight: '400',
    color: DS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  button: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  buttonBorder: {
    borderWidth: 1.5,
    borderColor: DS.border,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Partial credits
  partialInfo: {
    width: '100%',
    backgroundColor: DS.bgSurface2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  partialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partialItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  partialDivider: {
    width: 1,
    height: 20,
    backgroundColor: DS.border,
    marginHorizontal: 10,
  },
  partialNum: {
    fontSize: 16,
    fontWeight: '800',
    color: DS.textPrimary,
  },
  partialLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: DS.textSecondary,
  },
  partialHint: {
    fontSize: 11,
    fontWeight: '500',
    color: DS.accentGold,
    textAlign: 'center',
    marginTop: 8,
  },
});