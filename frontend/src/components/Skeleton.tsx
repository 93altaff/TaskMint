import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, ViewStyle, Easing } from "react-native";

type Props = {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: ViewStyle;
};

/**
 * Reusable shimmer/pulse skeleton block. Used by HomeSkeleton to draw the
 * Home tab placeholder during cold-start / first data load.
 *
 * Usage:
 *   <Skeleton width="100%" height={80} radius={12} />
 */
export default function Skeleton({ width = "100%", height = 14, radius = 8, style }: Props) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as any, height: height as any, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: "#E5E7EB",
  },
});
