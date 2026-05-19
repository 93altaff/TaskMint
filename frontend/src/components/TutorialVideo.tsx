import React, { useCallback, useState } from "react";
import {
  View, StyleSheet, Text, TouchableOpacity, Linking, ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";
import { PlayCircle, ExternalLink } from "lucide-react-native";
import { theme } from "../lib/theme";

/**
 * Inline YouTube tutorial player using react-native-youtube-iframe.
 *
 * Plays directly inside the app at the correct 16:9 aspect ratio so there
 * is NEVER any extra black space below the video.
 *
 * Falls back to a clean "Open in YouTube" button when the uploader has
 * disabled embedding (YouTube error codes 100/101/150/152/153) — no library
 * can override that uploader setting.
 */
export default function TutorialVideo({ videoId }: { videoId: string }) {
  const [ready, setReady] = useState(false);
  const [embedBlocked, setEmbedBlocked] = useState(false);
  // The card is rendered inside a parent with horizontal padding (theme.spacing.lg = 16)
  // and the card itself has horizontal padding too — so available video width
  // is roughly winW − 64. Cap at 540 for tablets, floor at 220.
  const { width: winW } = useWindowDimensions();
  const videoWidth = Math.max(220, Math.min(540, winW - 64));
  const videoHeight = Math.round((videoWidth * 9) / 16);

  const onError = useCallback((e: string) => {
    if (["100", "101", "150", "152", "153"].includes(e)) setEmbedBlocked(true);
  }, []);

  const openExternal = useCallback(async () => {
    const appUrl = `vnd.youtube://${videoId}`;
    const webUrl = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      const canApp = await Linking.canOpenURL(appUrl);
      await Linking.openURL(canApp ? appUrl : webUrl);
    } catch {
      try { await Linking.openURL(webUrl); } catch {}
    }
  }, [videoId]);

  if (embedBlocked) {
    return (
      <TouchableOpacity
        style={[styles.fallback, { height: videoHeight }]}
        activeOpacity={0.85}
        onPress={openExternal}
        testID="tutorial-video-fallback"
      >
        <PlayCircle size={42} color="#fff" />
        <Text style={styles.fallbackTitle}>Inline playback disabled by uploader</Text>
        <View style={styles.fallbackBtn}>
          <ExternalLink size={14} color="#fff" />
          <Text style={styles.fallbackBtnText}>Open in YouTube</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.wrap, { height: videoHeight }]} testID="tutorial-video">
      <YoutubePlayer
        height={videoHeight}
        width={videoWidth}
        videoId={videoId}
        play={false}
        onReady={() => setReady(true)}
        onError={onError}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
          androidLayerType: "hardware",
        }}
        initialPlayerParams={{
          modestbranding: true,
          rel: false,
          loop: false,
          controls: true,
          preventFullScreen: false,
        }}
      />
      {!ready && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radii.md,
    overflow: "hidden",
    backgroundColor: "#000",
    marginTop: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  fallback: {
    borderRadius: theme.radii.md,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    padding: 16,
    gap: 10,
  },
  fallbackTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
  fallbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 4,
  },
  fallbackBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
});
