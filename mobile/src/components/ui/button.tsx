import type { ReactNode } from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/src/components/ui/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "lg";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: ButtonVariant;
};

const variantStyles = {
  primary: {
    backgroundColor: colors.ai,
    borderColor: colors.ai,
  },
  secondary: {
    backgroundColor: colors.camera,
    borderColor: colors.camera,
  },
  ghost: {
    backgroundColor: colors.transparent,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
} satisfies Record<ButtonVariant, ViewStyle>;

const labelColors = {
  primary: colors.aiText,
  secondary: colors.textOnDark,
  ghost: colors.text,
  danger: colors.white,
} satisfies Record<ButtonVariant, string>;

const sizeStyles = {
  md: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  lg: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
} satisfies Record<ButtonSize, ViewStyle>;

export function Button({
  disabled,
  icon,
  label,
  loading,
  onPress,
  size = "md",
  style,
  textStyle,
  variant = "primary",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: "center",
          borderCurve: "continuous",
          borderRadius: radius.md,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing.xs,
          justifyContent: "center",
          opacity: isDisabled ? 0.48 : 1,
        },
        variantStyles[variant],
        sizeStyles[size],
        pressed && !isDisabled
          ? {
              transform: [{ scale: 0.98 }],
            }
          : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColors[variant]} />
      ) : (
        <>
          {icon ? (
            <View style={{ height: 20, width: 20 }}>{icon}</View>
          ) : null}
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            style={[
              typography.label,
              {
                color: labelColors[variant],
                flexShrink: 1,
                textAlign: "center",
              },
              textStyle,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
