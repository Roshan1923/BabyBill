/* eslint-disable react-native/no-inline-styles */
import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

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
  negative:      '#C8402A',
  border:        '#EDE8E0',
  shadow:        'rgba(26,58,107,0.10)',
  pagePad:       20,
  navHeight:     80,
};

// Status configs
const STATUS = {
  uploading: {
    label: 'Uploading',
    color: DS.accentGold,
    bg: DS.accentGoldSub,
    icon: 'cloud-upload-outline',
  },
  processing: {
    label: 'Processing',
    color: DS.brandNavy,
    bg: '#E8EFF8',
    icon: 'sparkles-outline',
  },
  ready: {
    label: 'Ready to Review',
    color: DS.positive,
    bg: '#E6F4ED',
    icon: 'checkmark-circle-outline',
  },
  failed: {
    label: 'Failed',
    color: DS.negative,
    bg: '#FDF2EF',
    icon: 'alert-circle-outline',
  },
};

function ReviewCard({ item, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const status = STATUS[item.status] || STATUS.processing;
  const isActive = item.status === 'uploading' || item.status === 'processing';

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start()
      }
      onPress={onPress}
      disabled={isActive}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        {/* Thumbnail */}
        <View style={styles.cardThumb}>
          <Image
            source={{ uri: 'file://' + item.photoPath }}
            style={styles.cardThumbImage}
            resizeMode="cover"
          />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.storeName || `Receipt ${item.index || ''}`}
          </Text>

          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            {isActive ? (
              <ActivityIndicator size={12} color={status.color} />
            ) : (
              <Ionicons name={status.icon} size={13} color={status.color} />
            )}
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>

          {/* Timestamp */}
          <Text style={styles.cardTime}>
            {item.capturedAt ? formatTimeAgo(item.capturedAt) : ''}
          </Text>
        </View>

        {/* Right action */}
        <View style={styles.cardRight}>
          {item.status === 'ready' && (
            <View style={styles.reviewBtn}>
              <Ionicons name="eye-outline" size={16} color={DS.brandNavy} />
            </View>
          )}
          {item.status === 'failed' && (
            <View style={styles.retryBtn}>
              <Ionicons name="refresh-outline" size={16} color={DS.negative} />
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
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

function EmptyReview() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="checkmark-done-outline" size={36} color={DS.positive} />
      </View>
      <Text style={styles.emptyTitle}>All caught up!</Text>
      <Text style={styles.emptySubtitle}>
        No receipts waiting for review. Scan some receipts to get started.
      </Text>
    </View>
  );
}

export default function ToReviewReceipts({ items = [], onPressItem, onRetry }) {
  const renderItem = ({ item, index }) => (
    <ReviewCard
      item={{ ...item, index: index + 1 }}
      onPress={() => {
        if (item.status === 'ready') onPressItem?.(item);
        if (item.status === 'failed') onRetry?.(item);
      }}
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
        items.length > 0 ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {items.filter((i) => i.status === 'ready').length} ready
              {items.filter((i) => i.status === 'processing' || i.status === 'uploading').length > 0
                ? ` · ${items.filter((i) => i.status === 'processing' || i.status === 'uploading').length} processing`
                : ''}
              {items.filter((i) => i.status === 'failed').length > 0
                ? ` · ${items.filter((i) => i.status === 'failed').length} failed`
                : ''}
            </Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: DS.pagePad,
    paddingBottom: DS.navHeight + 24,
    paddingTop: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
  },

  // Summary row
  summaryRow: {
    paddingBottom: 12,
    paddingTop: 4,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '500',
    color: DS.textSecondary,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.bgSurface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: DS.border,
    ...Platform.select({
      ios: {
        shadowColor: DS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },

  // Thumbnail
  cardThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: DS.bgSurface2,
  },
  cardThumbImage: {
    width: '100%',
    height: '100%',
  },

  // Content
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.textPrimary,
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardTime: {
    fontSize: 11,
    fontWeight: '400',
    color: DS.textSecondary,
    marginTop: 4,
  },

  // Right action
  cardRight: {
    marginLeft: 8,
  },
  reviewBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8EFF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDF2EF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty
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
    backgroundColor: '#E6F4ED',
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