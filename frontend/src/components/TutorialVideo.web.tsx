import React from "react";
import { View, StyleSheet } from "react-native";
import { theme } from "../lib/theme";

/**
 * Web variant — embeds the YouTube iframe directly so playback happens
 * inline in the preview, matching the mobile experience. (If the uploader
 * disabled embedding on YouTube Studio the iframe will show YouTube's own
 * "Video unavailable" placeholder — same caveat as native.)
 */
export default function TutorialVideo({ videoId }: { videoId: string }) {
  const src = `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1`;
  return (
    <View style={styles.wrap} testID="tutorial-video">
      {React.createElement("iframe" as any, {
        src,
        style: {
          width: "100%",
          height: "100%",
          border: "0",
          borderRadius: theme.radii.md,
        },
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        allowFullScreen: true,
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 220,
    borderRadius: theme.radii.md,
    overflow: "hidden",
    backgroundColor: "#000",
    marginTop: 4,
  },
});
