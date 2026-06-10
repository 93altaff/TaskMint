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

// ---- Admin-controlled exchange ratio (points per ₹1) ----
// Default is 100 — overridden at runtime by AuthContext fetching /api/withdraw-settings
// or /api/app-config on app start. All UI conversions read from this live value so
// admin changes immediately reflect in BalanceCard, withdraw screen, refer payout
// previews, admin lists, etc.
let _exchangeRatio = 100;

export function setExchangeRatio(n: number) {
  if (typeof n === "number" && n > 0) _exchangeRatio = n;
}
export function getExchangeRatio(): number {
  return _exchangeRatio;
}
export const pointsToInr = (p: number) => (p / _exchangeRatio).toFixed(2);
