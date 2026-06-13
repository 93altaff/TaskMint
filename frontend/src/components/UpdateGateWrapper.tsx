import React from "react";
import { Modal, View, StyleSheet } from "react-native";
import { usePathname } from "expo-router";
import UpdateGate from "./UpdateGate";
import { useAuth } from "../context/AuthContext";

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
 * Renders `children` and overlays the UpdateGate via a Modal whenever
 * `active` is true, with two exemptions:
 *  • Profile route — users must always reach Profile (sign out / support)
 *  • Admin user — once signed in as admin, the gate is fully bypassed so
 *    admin can use the app, push fixes, or disable force-update from
 *    /admin/settings without being locked out.
 */
export default function UpdateGateWrapper({
  active, latestVersion, playStoreUrl, forceUpdate, releaseNotes, onSkip, children,
}: Props) {
  const pathname = usePathname() || "";
  const { user } = useAuth();
  const isProfileRoute = /profile/i.test(pathname);
  const isAdmin = !!user?.is_admin;

  const shouldShow = active && !isProfileRoute && !isAdmin;

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
