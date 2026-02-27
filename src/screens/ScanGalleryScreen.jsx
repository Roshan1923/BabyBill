/* eslint-disable react-native/no-inline-styles */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Animated,
  FlatList,
  Dimensions,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useScanQueue } from '../context/ScanContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const OVERLAY = {
  btnBg:      'rgba(15, 15, 15, 0.5)',
  btnBorder:  'rgba(255, 255, 255, 0.15)',
  pillBg:     'rgba(15, 15, 15, 0.55)',
  pillBorder: 'rgba(255, 255, 255, 0.12)',
};

const DS = {
  accentGold:  '#E8A020',
  negative:    '#C8402A',
  bgSurface:   '#FFFEFB',
  textPrimary: '#1C1610',
  textSecondary:'#8A7E72',
  textInverse: '#FFFEFB',
  border:      '#EDE8E0',
  brandNavy:   '#1A3A6B',
};

export default function ScanGalleryScreen({ navigation }) {
  const { scans, removeScan, clearScans } = useScanQueue();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rotations, setRotations] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const flatListRef = useRef(null);
  const rotateAnims = useRef({}).current;

  // If no scans, go back
  React.useEffect(() => {
    if (scans.length === 0) {
      navigation.goBack();
    }
  }, [scans.length]);

  const currentScan = scans[currentIndex] || null;

  // Get or create rotation anim for a scan
  const getRotateAnim = (id) => {
    if (!rotateAnims[id]) {
      rotateAnims[id] = new Animated.Value(0);
    }
    return rotateAnims[id];
  };

  const handleScroll = useCallback((event) => {
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < scans.length) {
      setCurrentIndex(index);
    }
  }, [currentIndex, scans.length]);

  const handleRotate = () => {
    if (!currentScan) return;
    const id = currentScan.id;
    const current = rotations[id] || currentScan.rotation || 0;
    const next = current + 90;
    setRotations((prev) => ({ ...prev, [id]: next }));

    const anim = getRotateAnim(id);
    Animated.spring(anim, {
      toValue: next / 90,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!currentScan) return;
    setShowDeleteModal(false);

    const newIndex = currentIndex >= scans.length - 1
      ? Math.max(0, scans.length - 2)
      : currentIndex;

    removeScan(currentScan.id);
    setCurrentIndex(newIndex);

    // Scroll to new index after deletion
    if (scans.length > 1) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
      }, 100);
    }
  };

  const handleRetake = () => {
    if (!currentScan) return;
    removeScan(currentScan.id);
    navigation.goBack(); // Back to camera to reshoot
  };

  const handleBack = () => navigation.goBack();

  const handleDone = () => navigation.goBack();

  const renderItem = ({ item }) => {
    const anim = getRotateAnim(item.id);
    const rot = rotations[item.id] || item.rotation || 0;
    // Ensure anim value is set
    if (rot > 0 && anim._value === 0) {
      anim.setValue(rot / 90);
    }
    const rotateInterpolate = anim.interpolate({
      inputRange: Array.from({ length: 20 }, (_, i) => i),
      outputRange: Array.from({ length: 20 }, (_, i) => `${i * 90}deg`),
    });

    return (
      <View style={styles.slide}>
        <Animated.Image
          source={{ uri: 'file://' + item.photoPath }}
          style={[
            styles.slideImage,
            { transform: [{ rotate: rotateInterpolate }] },
          ]}
          resizeMode="contain"
        />
      </View>
    );
  };

  if (!currentScan) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Image carousel ── */}
      <FlatList
        ref={flatListRef}
        data={scans}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        initialScrollIndex={currentIndex}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Top gradient ── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.2)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />

      {/* ── Bottom gradient ── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.55)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* ── Top bar: Back · Counter · Done ── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.counterPill}>
          <Text style={styles.counterText}>
            {currentIndex + 1} of {scans.length}
          </Text>
        </View>

        <TouchableOpacity style={styles.topBtn} onPress={handleDone} activeOpacity={0.7}>
          <Ionicons name="checkmark" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Dot indicators ── */}
      {scans.length > 1 && scans.length <= 10 && (
        <View style={styles.dotRow}>
          {scans.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}

      {/* ── Bottom actions: Delete · Retake · Rotate ── */}
      <View style={styles.bottomBar}>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleDelete} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={20} color="rgba(255,120,100,0.9)" />
            <Text style={[styles.actionLabel, { color: 'rgba(255,120,100,0.9)' }]}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleRetake} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={20} color="rgba(255,255,255,0.85)" />
            <Text style={styles.actionLabel}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleRotate} activeOpacity={0.7}>
            <Ionicons name="sync-outline" size={20} color="rgba(255,255,255,0.85)" />
            <Text style={styles.actionLabel}>Rotate</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Delete confirmation modal ── */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="trash-outline" size={26} color={DS.negative} />
            </View>
            <Text style={styles.modalTitle}>Delete This Scan?</Text>
            <Text style={styles.modalMessage}>
              This will remove scan {currentIndex + 1} of {scans.length} from your batch.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowDeleteModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDestructive]}
                onPress={confirmDelete}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // Carousel
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },

  // Gradients
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 150 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 180 },

  // Top bar
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20,
  },
  topBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: OVERLAY.btnBg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: OVERLAY.btnBorder,
  },
  counterPill: {
    backgroundColor: OVERLAY.pillBg,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: OVERLAY.pillBorder,
  },
  counterText: {
    fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.9)',
  },

  // Dot indicators
  dotRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : (StatusBar.currentHeight || 24) + 66,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: DS.accentGold,
    width: 18, borderRadius: 3,
  },

  // Bottom actions
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
    paddingHorizontal: 20,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionLabel: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)',
  },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: DS.bgSurface, borderRadius: 24, padding: 28,
    alignItems: 'center', width: '100%', maxWidth: 340,
    borderWidth: 1, borderColor: DS.border,
  },
  modalIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#FDF2EF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: DS.textPrimary, marginBottom: 8, textAlign: 'center' },
  modalMessage: { fontSize: 14, color: DS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  modalBtn: {
    flex: 1, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  },
  modalBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: DS.border },
  modalBtnDestructive: { backgroundColor: DS.negative },
  modalBtnSecondaryText: { fontSize: 16, fontWeight: '600', color: DS.textSecondary },
  modalBtnText: { fontSize: 16, fontWeight: '600', color: DS.textInverse },
});