/* eslint-disable react-native/no-inline-styles */
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Platform,
  Image,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DS = {
  bgPage:        '#FAF8F4',
  bgSurface:     '#FFFEFB',
  bgSurface2:    '#F5F2EC',
  brandNavy:     '#1A3A6B',
  accentGold:    '#E8A020',
  accentGoldSub: '#FEF3DC',
  textPrimary:   '#1C1610',
  textSecondary: '#8A7E72',
  textInverse:   '#FFFEFB',
  positive:      '#2A8C5C',
  positiveSub:   '#E8F5EE',
  negative:      '#C8402A',
  negativeSub:   '#FDF2EF',
  border:        '#EDE8E0',
  shadow:        'rgba(26,58,107,0.10)',
  pagePad:       20,
  navHeight:     80,
};

// ─── Animated Progress Bar ───────────────────────────────────

function ProgressBar({ status }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'uploading') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(progress, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
          Animated.timing(progress, { toValue: 0.15, duration: 800, useNativeDriver: false }),
        ])
      ).start();
    } else if (status === 'processing') {
      progress.setValue(0.4);
      Animated.loop(
        Animated.sequence([
          Animated.timing(progress, { toValue: 0.85, duration: 1500, useNativeDriver: false }),
          Animated.timing(progress, { toValue: 0.5, duration: 1000, useNativeDriver: false }),
        ])
      ).start();
    } else if (status === 'ready') {
      Animated.timing(progress, { toValue: 1, duration: 300, useNativeDriver: false }).start();
    } else {
      progress.setValue(0);
    }
  }, [status]);

  const barColor = status === 'ready' ? DS.positive
    : status === 'failed' ? DS.negative
    : DS.accentGold;

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={pStyles.track}>
      <Animated.View style={[pStyles.bar, { width, backgroundColor: barColor }]} />
    </View>
  );
}

const pStyles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: DS.bgSurface2,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 2,
  },
});

// ─── Status Configs ──────────────────────────────────────────

const STATUS_CONFIG = {
  uploading: {
    label: 'Uploading…',
    sublabel: 'Sending to server',
    color: DS.accentGold,
    bg: DS.accentGoldSub,
    icon: 'cloud-upload-outline',
  },
  processing: {
    label: 'Processing…',
    sublabel: 'Extracting receipt data',
    color: DS.brandNavy,
    bg: '#E8EFF8',
    icon: 'sparkles-outline',
  },
  ready: {
    label: 'Ready',
    sublabel: 'Tap to review details',
    color: DS.positive,
    bg: DS.positiveSub,
    icon: 'checkmark-circle',
  },
  failed: {
    label: 'Failed',
    sublabel: 'Tap to see details',
    color: DS.negative,
    bg: DS.negativeSub,
    icon: 'alert-circle',
  },
};

// ─── Review Card ─────────────────────────────────────────────

function ReviewCard({ item, onPress, onDelete, onForceSave, onUpgrade }) {
  const scale = useRef(new Animated.Value(1)).current;
  const enterAnim = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);

  const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.processing;
  const isActive = item.status === 'uploading' || item.status === 'processing';
  const isFailed = item.status === 'failed';
  const isReady = item.status === 'ready';

  useEffect(() => {
    Animated.spring(enterAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 6,
    }).start();
  }, []);

  const handlePress = () => {
    if (isReady) {
      onPress?.(item);
    } else if (isFailed) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(!expanded);
    }
  };

  const cardBorderColor = isFailed
    ? 'rgba(200, 64, 42, 0.2)'
    : isReady
    ? 'rgba(42, 140, 92, 0.2)'
    : DS.border;

  return (
    <Animated.View
      style={{
        opacity: enterAnim,
        transform: [
          { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
          { scale },
        ],
      }}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => {
          if (!isActive)
            Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
        }}
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start()
        }
        onPress={handlePress}
        disabled={isActive}
      >
        <View style={[styles.card, { borderColor: cardBorderColor }]}>
          {/* Main row */}
          <View style={styles.cardRow}>
            <View style={styles.thumbWrap}>
              <Image
                source={{ uri: 'file://' + item.photoPath }}
                style={styles.thumbImage}
                resizeMode="cover"
              />
              {isActive && (
                <View style={styles.thumbOverlay}>
                  <Ionicons name={config.icon} size={18} color="#fff" />
                </View>
              )}
              {isReady && (
                <View style={[styles.thumbBadge, { backgroundColor: DS.positive }]}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
              {isFailed && (
                <View style={[styles.thumbBadge, { backgroundColor: DS.negative }]}>
                  <Ionicons name="close" size={10} color="#fff" />
                </View>
              )}
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.storeName || `Receipt #${item.index || ''}`}
              </Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                <Text style={[styles.statusLabel, { color: config.color }]}>
                  {config.label}
                </Text>
                <Text style={styles.statusSublabel}>{config.sublabel}</Text>
              </View>
              <Text style={styles.cardTime}>
                {item.capturedAt ? formatTimeAgo(item.capturedAt) : ''}
              </Text>
            </View>

            <View style={styles.cardAction}>
              {isReady && (
                <View style={styles.reviewChevron}>
                  <Ionicons name="chevron-forward" size={18} color={DS.brandNavy} />
                </View>
              )}
              {isFailed && (
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={DS.textSecondary}
                />
              )}
            </View>
          </View>

          {(isActive || isReady) && <ProgressBar status={item.status} />}

          {/* Expanded error section */}
          {isFailed && expanded && (
            <View style={styles.errorSection}>
              <View style={styles.errorBox}>
                <Ionicons
                  name={item.isDuplicate ? 'copy-outline' : 'information-circle-outline'}
                  size={16}
                  color={DS.negative}
                />
                <Text style={styles.errorText} numberOfLines={4}>
                  {item.error || 'An unknown error occurred while processing this receipt.'}
                </Text>
              </View>
              <View style={styles.errorBtnRow}>
    {item.isDuplicate && (
      <TouchableOpacity
        style={styles.saveAnywayBtn}
        onPress={() => onForceSave?.(item)}
        activeOpacity={0.8}
      >
        <Ionicons name="save-outline" size={15} color={DS.brandNavy} />
        <Text style={styles.saveAnywayText}>Save Anyway</Text>
      </TouchableOpacity>
    )}
    {item.isLimitReached && (
      <TouchableOpacity
        style={[styles.saveAnywayBtn, { backgroundColor: '#FEF3DC', borderColor: 'rgba(232,160,32,0.25)' }]}
        onPress={() => onUpgrade?.()}
        activeOpacity={0.8}
      >
        <Ionicons name="flash" size={15} color="#E8A020" />
        <Text style={[styles.saveAnywayText, { color: '#E8A020' }]}>Upgrade</Text>
      </TouchableOpacity>
    )}
    <TouchableOpacity
      style={styles.deleteBtn}
      onPress={() => onDelete?.(item)}
      activeOpacity={0.8}
    >
      <Ionicons name="trash-outline" size={16} color={DS.textInverse} />
      <Text style={styles.deleteBtnText}>Delete</Text>
    </TouchableOpacity>
</View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Summary Header ──────────────────────────────────────────

function SummaryHeader({ items }) {
  const ready = items.filter((i) => i.status === 'ready').length;
  const active = items.filter((i) => i.status === 'uploading' || i.status === 'processing').length;
  const failed = items.filter((i) => i.status === 'failed').length;

  return (
    <View style={styles.summaryRow}>
      {active > 0 && (
        <View style={[styles.summaryPill, { backgroundColor: DS.accentGoldSub }]}>
          <View style={[styles.summaryDot, { backgroundColor: DS.accentGold }]} />
          <Text style={[styles.summaryPillText, { color: DS.accentGold }]}>
            {active} processing
          </Text>
        </View>
      )}
      {ready > 0 && (
        <View style={[styles.summaryPill, { backgroundColor: DS.positiveSub }]}>
          <View style={[styles.summaryDot, { backgroundColor: DS.positive }]} />
          <Text style={[styles.summaryPillText, { color: DS.positive }]}>
            {ready} ready
          </Text>
        </View>
      )}
      {failed > 0 && (
        <View style={[styles.summaryPill, { backgroundColor: DS.negativeSub }]}>
          <View style={[styles.summaryDot, { backgroundColor: DS.negative }]} />
          <Text style={[styles.summaryPillText, { color: DS.negative }]}>
            {failed} failed
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Empty State ─────────────────────────────────────────────

function EmptyReview() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="checkmark-done-outline" size={36} color={DS.positive} />
      </View>
      <Text style={styles.emptyTitle}>All caught up!</Text>
      <Text style={styles.emptySubtitle}>
        No receipts waiting for review.{'\n'}Scan some receipts to get started.
      </Text>
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function ToReviewReceipts({ items = [], onPressItem, onDelete, onForceSave, onUpgrade }) {
  const renderItem = ({ item, index }) => (
    <ReviewCard
      item={{ ...item, index: index + 1 }}
      onPress={() => onPressItem?.(item)}
      onDelete={() => onDelete?.(item)}
      onForceSave={() => onForceSave?.(item)}
      onUpgrade={() => onUpgrade?.()}
    />
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={[
        styles.listContent,
        items.length === 0 && styles.listContentEmpty,
      ]}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<EmptyReview />}
      ListHeaderComponent={
        items.length > 0 ? <SummaryHeader items={items} /> : null
      }
    />
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: DS.pagePad,
    paddingBottom: DS.navHeight + 24,
    paddingTop: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
  },

  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 14,
    paddingTop: 4,
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  summaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryPillText: {
    fontSize: 12,
    fontWeight: '600',
  },

  card: {
    backgroundColor: DS.bgSurface,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: DS.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: DS.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.9,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },

  thumbWrap: {
    width: 60,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: DS.bgSurface2,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: DS.bgSurface,
  },

  cardContent: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DS.textPrimary,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusSublabel: {
    fontSize: 12,
    fontWeight: '400',
    color: DS.textSecondary,
    marginLeft: 2,
  },
  cardTime: {
    fontSize: 11,
    fontWeight: '400',
    color: DS.textSecondary,
    marginTop: 2,
  },

  cardAction: {
    marginLeft: 8,
    width: 28,
    alignItems: 'center',
  },
  reviewChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8EFF8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorSection: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: DS.negativeSub,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: DS.negative,
    lineHeight: 18,
  },
  errorBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saveAnywayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E8EFF8',
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(26, 58, 107, 0.15)',
  },
  saveAnywayText: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.brandNavy,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: DS.negative,
    height: 38,
    borderRadius: 10,
    flex: 1,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.textInverse,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: DS.positiveSub,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DS.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: DS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});