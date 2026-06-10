import React from "react";
import { Modal, View, StyleSheet } from "react-native";
import { usePathname } from "expo-router";
import UpdateGate from "./UpdateGate";

type Props = {
  active: boolean;
  latestVersion: string;
  playStoreUrl: string;
  forceUpdate: boolean;
  releaseNotes?: string;
  onSkip: () => void;
  children: React.ReactNode;
};

/**
 * Renders `children` (the normal app tree) and overlays the UpdateGate
 * via a full-screen Modal whenever `active` is true AND the user is NOT
 * on the Profile tab.
 *
 * This lets users always reach Profile (sign out / contact support)
 * even during a force-update — per product spec #11.
 */
export default function UpdateGateWrapper({
  active, latestVersion, playStoreUrl, forceUpdate, releaseNotes, onSkip, children,
}: Props) {
  const pathname = usePathname() || "";
  // Match both "/profile" and "/(tabs)/profile".
  const isProfileRoute = /profile/i.test(pathname);
  const shouldShow = active && !isProfileRoute;

  return (
    <View style={{ flex: 1 }}>
      {children}
      <Modal
        visible={shouldShow}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        hardwareAccelerated
      >
        <View style={styles.full}>
          <UpdateGate
            latestVersion={latestVersion}
            playStoreUrl={playStoreUrl}
            forceUpdate={forceUpdate}
            releaseNotes={releaseNotes}
            onDismiss={onSkip}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
});
