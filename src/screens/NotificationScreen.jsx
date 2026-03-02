/* eslint-disable react-native/no-inline-styles */
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/Feather';
import { useNotifications } from '../context/NotificationContext';
import { useProcessing } from '../context/ProcessingContext';

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
};

const TYPE_CONFIG = {
  receipt_ready: { icon: 'checkmark-circle', color: DS.positive, bg: DS.positiveSub },
  receipt_failed: { icon: 'alert-circle', color: DS.negative, bg: DS.negativeSub },
  duplicate: { icon: 'copy-outline', color: DS.accentGold, bg: DS.accentGoldSub },
  info: { icon: 'information-circle-outline', color: DS.brandNavy, bg: '#E8EFF8' },
};

// ─── Time helper ─────────────────────────────────────────────

function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ─── Processing Status Banner ────────────────────────────────

function ProcessingBanner({ navigation }) {
  const { jobs } = useProcessing();
  const active = jobs.filter((j) => j.status === 'uploading' || j.status === 'processing').length;
  const ready = jobs.filter((j) => j.status === 'ready').length;
  const failed = jobs.filter((j) => j.status === 'failed').length;

  if (active === 0 && ready === 0 && failed === 0) {
    return (
      <View style={[styles.banner, { backgroundColor: DS.positiveSub }]}>
        <Ionicons name="checkmark-circle" size={18} color={DS.positive} />
        <Text style={[styles.bannerText, { color: DS.positive }]}>All receipts processed</Text>
      </View>
    );
  }

  return (
    <View style={styles.bannerGroup}>
      {active > 0 && (
        <View style={[styles.banner, { backgroundColor: DS.accentGoldSub }]}>
          <Ionicons name="hourglass-outline" size={16} color={DS.accentGold} />
          <Text style={[styles.bannerText, { color: '#B8860B' }]}>
            {active} receipt{active > 1 ? 's' : ''} processing…
          </Text>
        </View>
      )}
      {ready > 0 && (
        <TouchableOpacity
          style={[styles.banner, { backgroundColor: DS.positiveSub }]}
          onPress={() => navigation.navigate('Main', { screen: 'Receipts', params: { tab: 'review' } })}
          activeOpacity={0.7}
        >
          <Ionicons name="eye-outline" size={16} color={DS.positive} />
          <Text style={[styles.bannerText, { color: DS.positive, flex: 1 }]}>
            {ready} ready to review
          </Text>
          <Icon name="chevron-right" size={16} color={DS.positive} />
        </TouchableOpacity>
      )}
      {failed > 0 && (
        <TouchableOpacity
          style={[styles.banner, { backgroundColor: DS.negativeSub }]}
          onPress={() => navigation.navigate('Main', { screen: 'Receipts', params: { tab: 'review' } })}
          activeOpacity={0.7}
        >
          <Ionicons name="alert-circle-outline" size={16} color={DS.negative} />
          <Text style={[styles.bannerText, { color: DS.negative, flex: 1 }]}>
            {failed} failed
          </Text>
          <Icon name="chevron-right" size={16} color={DS.negative} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Notification Card ───────────────────────────────────────

function NotificationCard({ item, onPress }) {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
  const isUnread = !item.read;

  return (
    <TouchableOpacity
      style={[styles.card, isUnread && styles.cardUnread]}
      onPress={() => onPress?.(item)}
      activeOpacity={0.7}
    >
      {/* Left icon */}
      <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
        <Ionicons name={config.icon} size={20} color={config.color} />
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.cardTitle, isUnread && { fontWeight: '700' }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardTime}>{formatTimeAgo(item.timestamp)}</Text>
        </View>
        <Text style={styles.cardMessage} numberOfLines={2}>
          {item.message}
        </Text>
      </View>

      {/* Unread dot */}
      {isUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

// ─── Empty State ─────────────────────────────────────────────

function EmptyNotifications() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyCircle}>
        <Ionicons name="notifications-off-outline" size={32} color={DS.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptySubtitle}>
        You'll see updates here when your{'\n'}receipts are processed.
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function NotificationScreen({ navigation }) {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();

  // Auto-mark all read after 2 seconds on screen
  useEffect(() => {
    if (unreadCount > 0) {
      const timer = setTimeout(() => markAllRead(), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handlePress = (item) => {
    markRead(item.id);
    if (item.type === 'receipt_ready' && item.data?.receipt) {
      navigation.navigate('Detail', { receipt: item.data.receipt });
    } else if (item.type === 'receipt_failed' || item.type === 'duplicate') {
      navigation.navigate('Main', { screen: 'Receipts', params: { tab: 'review' } });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.length > 0 ? (
          <TouchableOpacity onPress={clearAll} activeOpacity={0.7} style={styles.clearWrap}>
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      {/* Processing status */}
      <View style={styles.bannerWrap}>
        <ProcessingBanner navigation={navigation} />
      </View>

      {/* List */}
      {notifications.length === 0 ? (
        <EmptyNotifications />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationCard item={item} onPress={handlePress} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: DS.pagePad,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 4 : 4,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: DS.bgSurface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: DS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: DS.textPrimary },
  clearWrap: { paddingVertical: 4, paddingHorizontal: 8 },
  clearText: { fontSize: 14, fontWeight: '600', color: DS.negative },

  // Banners
  bannerWrap: { paddingHorizontal: DS.pagePad, paddingTop: 14, paddingBottom: 6 },
  bannerGroup: { gap: 6 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
  },
  bannerText: { fontSize: 14, fontWeight: '600' },

  // List
  listContent: { paddingHorizontal: DS.pagePad, paddingTop: 8, paddingBottom: 32 },
  separator: { height: 1, backgroundColor: DS.border, marginLeft: 62 },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, gap: 12,
  },
  cardUnread: {
    backgroundColor: 'rgba(26, 58, 107, 0.03)',
    marginHorizontal: -DS.pagePad, paddingHorizontal: DS.pagePad,
    borderRadius: 0,
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  cardContent: { flex: 1 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: DS.textPrimary, flex: 1, marginRight: 8 },
  cardTime: { fontSize: 12, fontWeight: '400', color: DS.textSecondary },
  cardMessage: { fontSize: 13, fontWeight: '400', color: DS.textSecondary, lineHeight: 18 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: DS.accentGold,
    marginTop: 18, marginLeft: 4,
  },

  // Empty
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: DS.bgSurface2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: DS.textPrimary, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, fontWeight: '400', color: DS.textSecondary, textAlign: 'center', lineHeight: 20 },
});