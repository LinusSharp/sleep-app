// src/theme.ts

export const theme = {
  colors: {
    // Backgrounds
    background: "#0F172A", // Deep night blue/slate
    surface: "#1E293B", // Lighter slate for cards
    surfaceHighlight: "#334155", // For tapped items or inputs

    // Brand Colors (Matching your Purple Icon)
    primary: "#8B5CF6", // Violet/Purple
    primaryDark: "#7C3AED",
    accent: "#F59E0B", // Amber/Gold (for wins/streaks)

    // Text
    textPrimary: "#F8FAFC", // Almost white
    textSecondary: "#94A3B8", // Muted blue-grey
    textTertiary: "#64748B",

    // Status
    success: "#10B981", // Emerald
    error: "#EF4444", // Red
    info: "#3B82F6", // Blue

    // Borders
    border: "#334155",
  },
  spacing: {
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
  },
  borderRadius: {
    card: 16,
    button: 12,
    round: 999,
  },
};
