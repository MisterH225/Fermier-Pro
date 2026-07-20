import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const storageKey = (userId: string) =>
  `@fermier/healthVerifyCtaDismissed:${userId}`;

type Props = {
  userId: string | null | undefined;
  visible: boolean;
  onPressCta: () => void;
};

/**
 * Encart discret producteur — « Faites vérifier votre élevage ».
 * Dismissible (AsyncStorage), non intrusif (1 bandeau).
 */
export function HealthVerifyCtaBanner({
  userId,
  visible,
  onPressCta
}: Props) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !visible) {
      setDismissed(true);
      return;
    }
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        if (!cancelled) setDismissed(raw === "1");
      } catch {
        if (!cancelled) setDismissed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, visible]);

  if (!visible || dismissed || !userId) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.texts}>
        <Text style={styles.title}>
          {t("marketScreen.healthVerifyCta.title")}
        </Text>
        <Text style={styles.body}>
          {t("marketScreen.healthVerifyCta.body")}
        </Text>
        <Pressable onPress={onPressCta} hitSlop={8}>
          <Text style={styles.link}>{t("marketScreen.healthVerifyCta.action")}</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => {
          setDismissed(true);
          void AsyncStorage.setItem(storageKey(userId), "1");
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t("marketScreen.healthVerifyCta.dismiss")}
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
  dismiss: {
    fontSize: 22,
    lineHeight: 22,
    color: mobileColors.textSecondary,
    paddingHorizontal: 4
  }
});
