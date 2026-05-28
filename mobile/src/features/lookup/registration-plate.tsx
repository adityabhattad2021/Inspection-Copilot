import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/src/components/ui";

type RegistrationPlateSize = "compact" | "large";

type RegistrationPlateShellProps = PropsWithChildren<{
  size?: RegistrationPlateSize;
  style?: StyleProp<ViewStyle>;
}>;

type RegistrationPlateTextProps = {
  size?: RegistrationPlateSize;
  style?: StyleProp<ViewStyle>;
  value: string;
};

const plateSizes = {
  compact: {
    borderWidth: 1.5,
    fontSize: 13,
    indFontSize: 9,
    minHeight: 36,
    prefixWidth: 34,
  },
  large: {
    borderWidth: 2,
    fontSize: 24,
    indFontSize: 14,
    minHeight: 70,
    prefixWidth: 62,
  },
} as const;

export function formatRegistrationPlate(value: string) {
  const normalizedValue = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const state = normalizedValue.slice(0, 2);
  const rest = normalizedValue.slice(2);
  const district = rest.match(/^\d{1,2}/)?.[0] ?? "";
  const afterDistrict = rest.slice(district.length);
  const series = afterDistrict.match(/^[A-Z]{1,3}/)?.[0] ?? "";
  const number = afterDistrict.slice(series.length);

  return [state, district, series, number].filter(Boolean).join(" ");
}

export function RegistrationPlateShell({
  children,
  size = "large",
  style,
}: RegistrationPlateShellProps) {
  const sizeStyle = plateSizes[size];

  return (
    <View
      style={[
        {
          alignItems: "stretch",
          alignSelf: "stretch",
          backgroundColor: colors.white,
          borderColor: colors.text,
          borderCurve: "continuous",
          borderRadius: radius.md,
          borderWidth: sizeStyle.borderWidth,
          flexDirection: "row",
          minHeight: sizeStyle.minHeight,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#1D4F91",
          justifyContent: "center",
          paddingHorizontal: spacing.xs,
          width: sizeStyle.prefixWidth,
        }}
      >
        <Text
          selectable
          style={[
            typography.small,
            {
              color: colors.white,
              fontSize: sizeStyle.indFontSize,
              fontWeight: "900",
            },
          ]}
        >
          IND
        </Text>
      </View>
      {children}
    </View>
  );
}

export function RegistrationPlateText({
  size = "large",
  style,
  value,
}: RegistrationPlateTextProps) {
  const sizeStyle = plateSizes[size];

  return (
    <RegistrationPlateShell size={size} style={style}>
      <View
        style={{
          alignItems: "center",
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: spacing.sm,
        }}
      >
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          numberOfLines={1}
          selectable
          style={{
            color: colors.text,
            fontSize: sizeStyle.fontSize,
            fontVariant: ["tabular-nums"],
            fontWeight: "900",
            letterSpacing: 0,
            lineHeight: sizeStyle.fontSize + 8,
            textAlign: "center",
          }}
        >
          {formatRegistrationPlate(value)}
        </Text>
      </View>
    </RegistrationPlateShell>
  );
}
