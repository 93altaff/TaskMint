/**
 * Dynamic Lucide icon renderer.
 *
 * Admin enters any Lucide icon name (e.g. "Send", "Phone", "Globe") and we
 * render it at runtime without hardcoding a fixed list. We import the entire
 * lucide-react-native bundle, look the component up by name, and fall back to
 * a generic `Link` icon if the name is unknown — so the UI never crashes.
 *
 * Lucide ships ~1500+ icons, making this effectively unlimited from the
 * admin's perspective.
 */
import React from "react";
import * as Lucide from "lucide-react-native";

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;

export function renderProfileIcon(
  name: string | undefined,
  size = 18,
  color = "#4F46E5",
) {
  const lib = Lucide as unknown as Record<string, LucideIcon>;
  const Comp: LucideIcon = (name && lib[name]) || lib.Link;
  return <Comp size={size} color={color} />;
}
