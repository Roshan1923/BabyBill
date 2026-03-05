/* eslint-disable react-native/no-inline-styles */
import React from "react";
import { StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
const DOUBLE_TAP_ZOOM = 2.5;
const TIMING = { duration: 250 };

/**
 * ZoomableImage — pinch-to-zoom, pan, and double-tap zoom.
 *
 * Props:
 *  - uri: string (image URI)
 *  - style: optional container style overrides
 */
export default function ZoomableImage({ uri, style }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const pinchOriginX = useSharedValue(0);
  const pinchOriginY = useSharedValue(0);

  // Helper to clamp translation based on current scale
  const clampTranslation = (tx, ty, s) => {
    "worklet";
    const maxX = ((s - 1) * SCREEN_WIDTH) / 2;
    const maxY = ((s - 1) * SCREEN_HEIGHT) / 2;
    return {
      x: Math.min(Math.max(tx, -maxX), maxX),
      y: Math.min(Math.max(ty, -maxY), maxY),
    };
  };

  // ─── Double Tap ────────────────────────────────────────────
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd((event) => {
      "worklet";
      if (savedScale.value > 1.1) {
        // Zoom out to 1x
        scale.value = withTiming(1, TIMING);
        translateX.value = withTiming(0, TIMING);
        translateY.value = withTiming(0, TIMING);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in toward tap point
        const targetScale = DOUBLE_TAP_ZOOM;
        const focusX = event.x - SCREEN_WIDTH / 2;
        const focusY = event.y - SCREEN_HEIGHT / 2;
        const clamped = clampTranslation(
          -focusX * (targetScale - 1),
          -focusY * (targetScale - 1),
          targetScale
        );

        scale.value = withTiming(targetScale, TIMING);
        translateX.value = withTiming(clamped.x, TIMING);
        translateY.value = withTiming(clamped.y, TIMING);
        savedScale.value = targetScale;
        savedTranslateX.value = clamped.x;
        savedTranslateY.value = clamped.y;
      }
    });

  // ─── Pinch ─────────────────────────────────────────────────
  const pinch = Gesture.Pinch()
    .onStart((event) => {
      "worklet";
      pinchOriginX.value = event.focalX - SCREEN_WIDTH / 2;
      pinchOriginY.value = event.focalY - SCREEN_HEIGHT / 2;
    })
    .onUpdate((event) => {
      "worklet";
      // Direct assignment — no animation during gesture for instant response
      const newScale = Math.min(
        Math.max(savedScale.value * event.scale, ZOOM_MIN * 0.5),
        ZOOM_MAX
      );
      scale.value = newScale;

      // Translate so zoom centers on focal point
      const dx = pinchOriginX.value * (1 - event.scale);
      const dy = pinchOriginY.value * (1 - event.scale);
      translateX.value = savedTranslateX.value + dx;
      translateY.value = savedTranslateY.value + dy;
    })
    .onEnd(() => {
      "worklet";
      if (scale.value < ZOOM_MIN) {
        // Bounce back to 1x
        scale.value = withTiming(1, TIMING);
        translateX.value = withTiming(0, TIMING);
        translateY.value = withTiming(0, TIMING);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }

      savedScale.value = scale.value;

      // Clamp and animate to bounds
      const clamped = clampTranslation(
        translateX.value,
        translateY.value,
        scale.value
      );
      translateX.value = withTiming(clamped.x, TIMING);
      translateY.value = withTiming(clamped.y, TIMING);
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
    });

  // ─── Pan ───────────────────────────────────────────────────
  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onUpdate((event) => {
      "worklet";
      if (scale.value <= 1) return;
      // Direct assignment — instant response, no animation lag
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd((event) => {
      "worklet";
      if (scale.value <= 1) {
        translateX.value = withTiming(0, TIMING);
        translateY.value = withTiming(0, TIMING);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }

      const finalX = savedTranslateX.value + event.translationX;
      const finalY = savedTranslateY.value + event.translationY;

      // Clamp with animation for smooth snap to bounds
      const clamped = clampTranslation(finalX, finalY, scale.value);
      translateX.value = withTiming(clamped.x, TIMING);
      translateY.value = withTiming(clamped.y, TIMING);
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
    });

  // ─── Compose gestures ──────────────────────────────────────
  // Pinch and Pan run simultaneously (both fire during two-finger gestures)
  // Double-tap is separate — Race ensures single-tap doesn't block pinch
  const pinchPan = Gesture.Simultaneous(pinch, pan);
  const gesture = Gesture.Race(doubleTap, pinchPan);

  // ─── Animated style ────────────────────────────────────────
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureHandlerRootView style={[styles.container, style]}>
      <GestureDetector gesture={gesture}>
        <Animated.Image
          source={{ uri }}
          style={[styles.image, animatedStyle]}
          resizeMode="contain"
        />
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
});