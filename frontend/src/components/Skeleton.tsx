import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle, Easing } from "react-native";

type Props = {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: ViewStyle;
};

/**
 * Reusable shimmer/pulse skeleton block. Replace ActivityIndicator with a
 * layout of these to give users a sense of what's loading.
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

/** A pre-composed card-shaped skeleton (icon + 2 lines). */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <Skeleton width={56} height={56} radius={28} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="45%" height={12} />
      </View>
      <Skeleton width={50} height={20} radius={999} />
    </View>
  );
}

/** A skeleton banner placeholder. */
export function SkeletonBanner({ height = 110 }: { height?: number }) {
  return <Skeleton width="100%" height={height} radius={16} style={{ marginBottom: 12 }} />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: "#E5E7EB",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
});
