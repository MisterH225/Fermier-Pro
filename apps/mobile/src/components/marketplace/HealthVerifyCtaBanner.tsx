import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusSurfaces,
  mobileTypography
} from "../../theme/mobileTheme";

export type HealthVerifyCtaVariant = "default" | "expired";

const storageKey = (userId: string, variant: HealthVerifyCtaVariant) =>
  `@fermier/healthVerifyCtaDismissed:${variant}:${userId}`;

type Props = {
  userId: string | null | undefined;
  visible: boolean;
  onPressCta: () => void;
  /** `expired` = badge perdu récemment (&lt; 15 j). */
  variant?: HealthVerifyCtaVariant;
};

/**
 * Encart discret producteur — « Faites vérifier votre élevage ».
 * Variante `expired` après perte récente du badge.
 * Dismissible (AsyncStorage), non intrusif (1 bandeau).
 */
export function HealthVerifyCtaBanner({
  userId,
  visible,
  onPressCta,
  variant = "default"
}: Props) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(true);
  const i18nPrefix =
    variant === "expired"
      ? "marketScreen.healthVerifyCtaExpired"
      : "marketScreen.healthVerifyCta";

  useEffect(() => {
    let cancelled = false;
    if (!userId || !visible) {
      setDismissed(true);
      return;
    }
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey(userId, variant));
        if (!cancelled) setDismissed(raw === "1");
      } catch {
        if (!cancelled) setDismissed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, visible, variant]);

  if (!visible || dismissed || !userId) return null;

  return (
    <View
      style={[styles.wrap, variant === "expired" && styles.wrapExpired]}
    >
      <View style={styles.texts}>
        <Text style={styles.title}>{t(`${i18nPrefix}.title`)}</Text>
        <Text style={styles.body}>{t(`${i18nPrefix}.body`)}</Text>
        <Pressable onPress={onPressCta} hitSlop={8}>
          <Text
            style={[styles.link, variant === "expired" && styles.linkExpired]}
          >
            {t(`${i18nPrefix}.action`)}
          </Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => {
          setDismissed(true);
          void AsyncStorage.setItem(storageKey(userId, variant), "1");
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t(`${i18nPrefix}.dismiss`)}
      >
        <Text style={styles.dismiss}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.accent + "44",
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm
  },
  wrapExpired: {
    backgroundColor: mobileStatusSurfaces.warningBg,
    borderColor: mobileStatusSurfaces.warningText + "44"
  },
  texts: { flex: 1, gap: 4 },
  title: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  body: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  link: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.accent,
    marginTop: 2
  },
  linkExpired: {
    color: mobileStatusSurfaces.warningText
  },
  dismiss: {
    fontSize: 22,
    lineHeight: 22,
    color: mobileColors.textSecondary,
    paddingHorizontal: 4
  }
});
