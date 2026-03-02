import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import Icon from "react-native-vector-icons/Feather";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Design System Tokens ────────────────────────────────────
const DS = {
  bgPage:        "#FAF8F4",
  bgSurface:     "#FFFEFB",
  brandNavy:     "#1A3A6B",
  accentGold:    "#E8A020",
  accentGoldSub: "#FEF3DC",
  textPrimary:   "#1C1610",
  textSecondary: "#8A7E72",
  textInverse:   "#FFFEFB",
  positive:      "#2A8C5C",
  negative:      "#C8402A",
  border:        "#EDE8E0",
};

// Camera overlay colors (matching ScanScreen)
const OVERLAY = {
  pill:       "rgba(15, 15, 15, 0.55)",
  pillBorder: "rgba(255, 255, 255, 0.12)",
  btnBg:      "rgba(15, 15, 15, 0.5)",
  btnBorder:  "rgba(255, 255, 255, 0.15)",
  white80:    "rgba(255, 255, 255, 0.8)",
  white50:    "rgba(255, 255, 255, 0.5)",
};

export default function ImageReviewScreen({ navigation, route }) {
  const { photoPath, fromGallery } = route.params || {};
  const photoUri = photoPath?.startsWith("file://") ? photoPath : "file://" + photoPath;

  const [rotation, setRotation] = useState(0);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(1)).current;
  const keepScale = useRef(new Animated.Value(1)).current;

  // Entry animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4 }),
    ]).start();
  }, []);

  // Rotate handler — cycles 0 → 90 → 180 → 270 → 0
  const handleRotate = () => {
    const nextRotation = rotation + 90;
    setRotation(nextRotation);

    // Animate the rotation value
    Animated.spring(rotateAnim, {
      toValue: nextRotation,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();

    // Subtle scale pulse on the image
    Animated.sequence([
      Animated.timing(imageScale, { toValue: 0.92, duration: 100, useNativeDriver: true }),
      Animated.spring(imageScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
  };

  // Retake — go back to camera, discard this photo
  const handleRetake = () => {
    navigation.goBack();
  };

  // Keep Scan — save locally, go back to camera with this image in the stack
  const handleKeepScan = () => {
    // Button press animation
    Animated.sequence([
      Animated.timing(keepScale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(keepScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }),
    ]).start();

    // Navigate back to camera with the kept scan data
    navigation.navigate("Scan", {
      keptScan: {
        path: photoPath,
        uri: photoUri,
        rotation: rotation % 360,
        timestamp: Date.now(),
      },
    });
  };

  // Interpolate rotation for the image
  const imageRotation = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Image Display ── */}
      <Animated.View
        style={[
          styles.imageContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Animated.Image
          source={{ uri: photoUri }}
          style={[
            styles.image,
            {
              transform: [
                { scale: imageScale },
                { rotate: imageRotation },
              ],
            },
          ]}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.topPill}>
          <Ionicons name="document-text-outline" size={14} color={OVERLAY.white80} />
          <Text style={styles.topPillText}>Review Scan</Text>
        </View>

        <View style={{ width: 44 }} />
      </View>

      {/* ── Bottom Controls ── */}
      <View style={styles.bottomArea}>
        {/* Hint text */}
        <Text style={styles.hintText}>
          Check the image quality before keeping
        </Text>

        {/* Action Row — 3 buttons */}
        <View style={styles.actionRow}>
          {/* Retake */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleRetake}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="refresh" size={22} color="#fff" />
            </View>
            <Text style={styles.actionLabel}>Retake</Text>
          </TouchableOpacity>

          {/* Keep Scan — Primary */}
          <TouchableOpacity
            onPress={handleKeepScan}
            activeOpacity={1}
            style={styles.keepScanOuter}
          >
            <Animated.View style={[styles.keepScanBtn, { transform: [{ scale: keepScale }] }]}>
              <Ionicons name="checkmark" size={28} color="#000" />
            </Animated.View>
            <Text style={styles.keepScanLabel}>Keep Scan</Text>
          </TouchableOpacity>

          {/* Rotate */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleRotate}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="phone-landscape-outline" size={20} color="#fff" />
            </View>
            <Text style={styles.actionLabel}>Rotate</Text>
          </TouchableOpacity>
        </View>

        {/* Safe area spacer */}
        <View style={{ height: Platform.OS === "ios" ? 28 : 16 }} />
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  // ── Image ──────────────────────────────
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 100 : (StatusBar.currentHeight || 24) + 70,
    paddingBottom: 200,
  },
  image: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT * 0.55,
    borderRadius: 12,
  },

  // ── Top Bar ────────────────────────────
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : (StatusBar.currentHeight || 24) + 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: OVERLAY.btnBg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: OVERLAY.btnBorder,
  },
  topPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: OVERLAY.pill,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: OVERLAY.pillBorder,
  },
  topPillText: {
    fontSize: 14,
    fontWeight: "600",
    color: OVERLAY.white80,
  },

  // ── Bottom Area ────────────────────────
  bottomArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 8,
  },

  hintText: {
    fontSize: 13,
    fontWeight: "500",
    color: OVERLAY.white50,
    marginBottom: 20,
    textAlign: "center",
  },

  // ── Action Row ─────────────────────────
  actionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 32,
    gap: 40,
  },

  // Side buttons (Retake & Rotate)
  actionBtn: {
    alignItems: "center",
    gap: 8,
  },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: OVERLAY.btnBg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: OVERLAY.btnBorder,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: OVERLAY.white80,
  },

  // Keep Scan — primary gold button
  keepScanOuter: {
    alignItems: "center",
    gap: 8,
  },
  keepScanBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: DS.accentGold,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(232, 160, 32, 0.45)",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
    }),
  },
  keepScanLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: DS.accentGold,
  },
});