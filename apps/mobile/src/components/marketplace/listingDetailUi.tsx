import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileStatusSurfaces, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

export function DetailCard({
  children,
  style
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[detailStyles.card, style]}>{children}</View>;
}

export function DetailSectionLabel({ children }: { children: string }) {
  return <Text style={detailStyles.sectionLabel}>{children}</Text>;
}

export function DetailRow({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.rowLabel}>{label}</Text>
      <Text style={detailStyles.rowValue}>{value}</Text>
    </View>
  );
}

export function ListingStatusBadge({
  status,
  label
}: {
  status: string;
  label: string;
}) {
  const tone =
    status === "published"
      ? detailStyles.badgePublished
      : status === "sold"
        ? detailStyles.badgeSold
        : status === "expired"
          ? detailStyles.badgeExpired
          : detailStyles.badgeDefault;
  return (
    <View style={[detailStyles.statusBadge, tone]}>
      <Text style={[detailStyles.statusBadgeTx, listingStatusTextStyle(status)]}>
        {label}
      </Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    marginBottom: mobileSpacing.md,
    marginHorizontal: mobileSpacing.lg,
    ...mobileShadows.card
  },
  sectionLabel: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: mobileSpacing.md,
    marginBottom: mobileSpacing.xs
  },
  rowLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    flex: 1
  },
  rowValue: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600",
    flex: 1.2,
    textAlign: "right"
  },
  statusBadge: {
    alignSelf: "flex-end",
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill
  },
  statusBadgeTx: {
    ...mobileTypography.meta,
    fontWeight: "700",
    fontSize: mobileFontSize.xs
  },
  badgePublished: { backgroundColor: mobileColors.accentSoft },
  badgeSold: { backgroundColor: mobileColors.surfaceMuted },
  badgeExpired: { backgroundColor: mobileStatusSurfaces.errorBg },
  badgeDefault: { backgroundColor: mobileColors.surfaceMuted }
});

export const listingStatusTextStyle = (status: string) =>
  status === "published"
    ? { color: mobileColors.accent }
    : status === "expired"
      ? { color: mobileColors.error }
      : { color: mobileColors.textSecondary };
