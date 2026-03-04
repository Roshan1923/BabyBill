/* eslint-disable react-native/no-inline-styles */
import React from "react";
import { StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
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
const TIMING = { duration: 300 };

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
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);

  // ─── Double Tap ────────────────────────────────────────────
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (savedScale.value > 1.1) {
        // Zoom out
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
        let targetX = -focusX * (targetScale - 1);
        let targetY = -focusY * (targetScale - 1);

        // Clamp
        const maxX = ((targetScale - 1) * SCREEN_WIDTH) / 2;
        const maxY = ((targetScale - 1) * SCREEN_HEIGHT) / 2;
        targetX = Math.min(Math.max(targetX, -maxX), maxX);
        targetY = Math.min(Math.max(targetY, -maxY), maxY);

        scale.value = withTiming(targetScale, TIMING);
        translateX.value = withTiming(targetX, TIMING);
        translateY.value = withTiming(targetY, TIMING);
        savedScale.value = targetScale;
        savedTranslateX.value = targetX;
        savedTranslateY.value = targetY;
      }
    });

  // ─── Pinch ─────────────────────────────────────────────────
  const pinch = Gesture.Pinch()
    .onStart((event) => {
      originX.value = event.focalX - SCREEN_WIDTH / 2;
      originY.value = event.focalY - SCREEN_HEIGHT / 2;
    })
    .onUpdate((event) => {
      const newScale = Math.min(
        Math.max(savedScale.value * event.scale, ZOOM_MIN * 0.5),
        ZOOM_MAX
      );
      scale.value = newScale;

      const dx = originX.value * (1 - event.scale);
      const dy = originY.value * (1 - event.scale);
      translateX.value = savedTranslateX.value + dx;
      translateY.value = savedTranslateY.value + dy;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        // Snap back
        scale.value = withTiming(1, TIMING);
        translateX.value = withTiming(0, TIMING);
        translateY.value = withTiming(0, TIMING);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }

      savedScale.value = scale.value;

      // Clamp translation
      const maxX = ((scale.value - 1) * SCREEN_WIDTH) / 2;
      const maxY = ((scale.value - 1) * SCREEN_HEIGHT) / 2;
      const clampedX = Math.min(Math.max(translateX.value, -maxX), maxX);
      const clampedY = Math.min(Math.max(translateY.value, -maxY), maxY);

      translateX.value = withTiming(clampedX, TIMING);
      translateY.value = withTiming(clampedY, TIMING);
      savedTranslateX.value = clampedX;
      savedTranslateY.value = clampedY;
    });

  // ─── Pan ───────────────────────────────────────────────────
  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd((event) => {
      if (scale.value <= 1) {
        translateX.value = withTiming(0, TIMING);
        translateY.value = withTiming(0, TIMING);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }

      const finalX = savedTranslateX.value + event.translationX;
      const finalY = savedTranslateY.value + event.translationY;

      const maxX = ((scale.value - 1) * SCREEN_WIDTH) / 2;
      const maxY = ((scale.value - 1) * SCREEN_HEIGHT) / 2;
      const clampedX = Math.min(Math.max(finalX, -maxX), maxX);
      const clampedY = Math.min(Math.max(finalY, -maxY), maxY);

      translateX.value = withTiming(clampedX, TIMING);
      translateY.value = withTiming(clampedY, TIMING);
      savedTranslateX.value = clampedX;
      savedTranslateY.value = clampedY;
    });

  // ─── Compose gestures ──────────────────────────────────────
  const composed = Gesture.Simultaneous(pinch, pan);
  const gesture = Gesture.Exclusive(doubleTap, composed);

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