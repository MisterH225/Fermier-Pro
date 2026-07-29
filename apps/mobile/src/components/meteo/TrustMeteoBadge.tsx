import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import type { TrustScoreProfileType } from "../../lib/api/trustScore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { useTrustScore } from "../../hooks/useTrustScore";
import { getTrustLevelPresentation } from "./trustLevelPresentation";
import { TrustMeteoSheet } from "./TrustMeteoSheet";

type Props = {
  profileType: TrustScoreProfileType;
  /** Absent → /trust-score/me (profil actif). */
  userId?: string | null;
  visibility?: "self" | "counterpart" | "public";
  compact?: boolean;
};

/**
 * Badge tappable — niveau emoji/label → TrustMeteoSheet.
 */
export function TrustMeteoBadge({
  profileType,
  userId,
  visibility = userId ? "public" : "self",
  compact = true
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const q = useTrustScore({
    profileType,
    userId: userId ?? undefined,
    visibility,
    enabled: true
  });

  if (q.isPending && !q.data) {
    return (
      <ActivityIndicator
        size="small"
        color={mobileColors.textSecondary}
        style={styles.loader}
      />
    );
  }

  const trust = q.data;
  if (!trust && q.isError) {
    return null;
  }
  if (!trust) return null;

  const presentation = getTrustLevelPresentation(trust.level);
  const label = t(`trustScore.level.${trust.level}`, {
    defaultValue: trust.level
  });
  const color =
    presentation.tint === mobileColors.background
      ? mobileColors.textPrimary
      : presentation.tint;
  const bg = `${presentation.tint}22`;
  const border = `${presentation.tint}66`;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.wrap,
          compact && styles.compact,
          { borderColor: border, backgroundColor: bg }
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${t("trustScore.sheetTitle")} ${label}`}
      >
        <Text style={styles.prefix}>{t("trustScore.sheetTitle")}</Text>
        <Text style={[styles.text, { color }]}>
          {presentation.icon} {label}
        </Text>
      </Pressable>
      <TrustMeteoSheet
        visible={open}
        trust={trust}
        loading={q.isFetching}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loader: { alignSelf: "flex-start", marginTop: mobileSpacing.xs },
  wrap: {
    marginTop: mobileSpacing.xs,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth
  },
  compact: {
    paddingVertical: 5,
    paddingHorizontal: 8
  },
  prefix: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textSecondary
  },
  text: {
    ...mobileTypography.meta,
    fontWeight: "700"
  }
});
