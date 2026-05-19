export const theme = {
  colors: {
    bg: "#F7F9FC",
    surface: "#FFFFFF",
    primary: "#4F46E5",
    primarySoft: "rgba(79, 70, 229, 0.10)",
    secondary: "#FFC107",
    success: "#10B981",
    danger: "#FF6B6B",
    text: "#111827",
    muted: "#6B7280",
    border: "rgba(0,0,0,0.06)",
    overlay: "rgba(0,0,0,0.5)",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radii: { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 },
  shadow: {
    soft: {
      shadowColor: "#4F46E5",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 8,
    },
    card: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 3,
    },
  },
};

export const ADMIN_EMAIL = "93altaff@gmail.com";

export const pointsToInr = (p: number) => (p / 100).toFixed(2);
