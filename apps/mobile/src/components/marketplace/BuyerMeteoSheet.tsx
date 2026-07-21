import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { METEO_LEVELS } from "../../constants/meteoProfil";
import type { BuyerMeteoDto } from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { BaseModal } from "../modals/BaseModal";

type Props = {
  visible: boolean;
  meteo: BuyerMeteoDto | null;
  onClose: () => void;
};

/**
 * Bottom sheet — explique les 7 niveaux Météo + stats ponctualité
 * (sans late/default counts).
 */
export function BuyerMeteoSheet({ visible, meteo, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.meteoBuyer.sheetTitle")}
      sheetMaxHeight="70%"
    >
      <Text style={styles.intro}>{t("marketScreen.meteoBuyer.sheetIntro")}</Text>

      <View style={styles.levels}>
        {METEO_LEVELS.map((level, index) => {
          const active = meteo?.meteoLevel === level.id;
          return (
            <View
              key={level.id}
              style={[styles.levelRow, active && styles.levelRowActive]}
            >
              <Text style={styles.levelIcon}>{level.icon}</Text>
              <View style={styles.levelTexts}>
                <Text style={[styles.levelTitle, active && styles.levelTitleActive]}>
                  {t(`buyer.account.meteoLevel.${level.id}`, {
                    defaultValue: level.label
                  })}
                </Text>
                <Text style={styles.levelMeta}>
                  {t("marketScreen.meteoBuyer.levelIndex", {
                    n: index + 1,
                    total: METEO_LEVELS.length
                  })}
                </Text>
              </View>
              {active ? (
                <Text style={styles.currentTag}>
                  {t("marketScreen.meteoBuyer.current")}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {meteo ? (
        <Text style={styles.stats}>
          {t("marketScreen.meteoBuyer.stats", {
            total: meteo.creditTransactionsCount,
            onTime: meteo.creditOnTimeCount
          })}
        </Text>
      ) : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  intro: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  levels: { gap: 6 },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted
  },
  levelRowActive: {
    backgroundColor: mobileColors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.accent
  },
  levelIcon: { fontSize: mobileFontSize.xl },
  levelTexts: { flex: 1, gap: 1 },
  levelTitle: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  levelTitleActive: { color: mobileColors.accent },
  levelMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  currentTag: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.accent
  },
  stats: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.lg
  }
});
