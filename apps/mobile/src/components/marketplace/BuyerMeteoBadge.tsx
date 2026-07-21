import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  getMeteoLevel,
  creditScoreToNumeric,
  METEO_LEVELS
} from "../../constants/meteoProfil";
import type { BuyerMeteoDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { BuyerMeteoSheet } from "./BuyerMeteoSheet";
import { producerColors } from "../../theme/producerTheme";
import { marketplaceColors } from "../../theme/marketplaceTheme";

type Props = {
  meteo: BuyerMeteoDto | null | undefined;
  compact?: boolean;
};

const NEUTRAL = {
  color: marketplaceColors.meteoGrayText,
  bg: marketplaceColors.meteoGrayBg,
  border: marketplaceColors.meteoGrayBorder
};

/**
 * Badge Météo Acheteur compact (producteur) — cliquable → sheet 7 niveaux.
 * `nouveau` : neutre « Nouvel acheteur ». `creditBlocked` : « Acheteur suspendu ».
 */
export function BuyerMeteoBadge({ meteo, compact = true }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!meteo) return null;

  const blocked = meteo.creditBlocked === true;
  const isNew = meteo.creditScore === "nouveau";

  const level =
    METEO_LEVELS.find((l) => l.id === meteo.meteoLevel) ??
    getMeteoLevel(creditScoreToNumeric(meteo.creditScore));

  let label: string;
  let color: string;
  let bg: string;
  let border: string;
  let icon: string;

  if (blocked) {
    label = t("marketScreen.meteoBuyer.suspended");
    color = mobileColors.error;
    bg = producerColors.kpiRose;
    border = mobileColors.error + "55";
    icon = "⛔";
  } else if (isNew) {
    label = t("marketScreen.meteoBuyer.newBuyer");
    color = NEUTRAL.color;
    bg = NEUTRAL.bg;
    border = NEUTRAL.border;
    icon = "🌤️";
  } else {
    label = t(`buyer.account.meteoLevel.${level.id}`, {
      defaultValue: level.label
    });
    color = level.card_text === mobileColors.background ? level.card_bg : level.card_text;
    bg = level.card_bg + "22";
    border = level.card_bg + "66";
    icon = level.icon;
  }

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
        accessibilityLabel={`${t("marketScreen.meteoBuyer.label")} ${label}`}
      >
        <Text style={styles.prefix}>{t("marketScreen.meteoBuyer.label")}</Text>
        <Text style={[styles.text, { color }]}>
          {icon} {label}
        </Text>
      </Pressable>
      {blocked ? (
        <View style={styles.blockedHint}>
          <Text style={styles.blockedHintTx}>
            {t("marketScreen.meteoBuyer.suspendedHint")}
          </Text>
        </View>
      ) : null}
      <BuyerMeteoSheet
        visible={open}
        meteo={meteo}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: mobileSpacing.xs,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileRadius.md ?? 12,
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
  },
  blockedHint: {
    marginTop: 4,
    paddingHorizontal: 2
  },
  blockedHintTx: {
    ...mobileTypography.meta,
    color: mobileColors.error
  }
});
