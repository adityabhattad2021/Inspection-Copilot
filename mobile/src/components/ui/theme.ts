import type { TextStyle, ViewStyle } from "react-native";

export const colors = {
  background: "#F6F7F2",
  camera: "#101820",
  cameraRaised: "#17211F",
  surface: "#FFFFFF",
  surfaceMuted: "#ECEFE8",
  surfaceStrong: "#DFE6D8",
  border: "#D7DED0",
  borderStrong: "#AEB8A5",
  text: "#111611",
  textMuted: "#5E665C",
  textSubtle: "#7B8478",
  textOnDark: "#F7FAEF",
  ai: "#D7F85C",
  aiSoft: "#EEF9BE",
  aiText: "#23310B",
  success: "#11845B",
  successSoft: "#DFF4EA",
  warning: "#B7791F",
  warningSoft: "#FFF0C2",
  danger: "#C73D3D",
  dangerSoft: "#FCE1DD",
  white: "#FFFFFF",
  transparent: "transparent",
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  pill: 999,
} as const;

export const typography = {
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 28,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0,
    lineHeight: 22,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0,
    lineHeight: 21,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 18,
  },
  small: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 16,
  },
} satisfies Record<string, TextStyle>;

export const shadows = {
  card: {
    boxShadow: "0 8px 22px rgba(17, 22, 17, 0.08)",
  },
  lift: {
    boxShadow: "0 12px 30px rgba(17, 22, 17, 0.12)",
  },
} satisfies Record<string, ViewStyle>;

export type StatusTone = "neutral" | "ai" | "success" | "warning" | "danger";

export const statusTones = {
  neutral: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    color: colors.textMuted,
    dotColor: colors.borderStrong,
  },
  ai: {
    backgroundColor: colors.aiSoft,
    borderColor: colors.ai,
    color: colors.aiText,
    dotColor: colors.aiText,
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    color: colors.success,
    dotColor: colors.success,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    color: colors.warning,
    dotColor: colors.warning,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    color: colors.danger,
    dotColor: colors.danger,
  },
} satisfies Record<
  StatusTone,
  {
    backgroundColor: string;
    borderColor: string;
    color: string;
    dotColor: string;
  }
>;
