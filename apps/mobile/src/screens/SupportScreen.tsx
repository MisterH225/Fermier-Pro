import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MobileAppShell } from "../components/layout";
import { useBottomInset } from "../hooks/useBottomInset";
import { useSession } from "../context/SessionContext";
import { openPhoneCall } from "../lib/phone";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";

export function SupportScreen() {
  const { t } = useTranslation();
  const { supportContact } = useSession();
  const bottomInset = useBottomInset();

  const phone = supportContact.phone;
  const telegramUrl = supportContact.telegramUrl;
  const hasPhone = Boolean(phone);
  const hasTelegram = Boolean(telegramUrl);
  const isEmpty = !hasPhone && !hasTelegram;

  const onCall = () => {
    void openPhoneCall(phone, {
      errorTitle: t("support.phoneErrorTitle"),
      errorMessage: t("support.phoneUnavailable")
    });
  };

  const onTelegram = async () => {
    if (!telegramUrl) {
      return;
    }
    const can = await Linking.canOpenURL(telegramUrl);
    if (!can) {
      Alert.alert(
        t("support.telegramErrorTitle"),
        t("support.telegramUnavailable")
      );
      return;
    }
    await Linking.openURL(telegramUrl);
  };

  return (
    <MobileAppShell title={t("support.title")} omitBottomTabBar>
      <ScrollView
        contentContainerStyle={[
          styles.wrap,
          { paddingBottom: bottomInset }
        ]}
      >
        <Text style={styles.lead}>{t("support.lead")}</Text>

        {isEmpty ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t("support.unavailable")}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={onCall}
            disabled={!hasPhone}
            style={({ pressed }) => [
              styles.card,
              !hasPhone && styles.cardDisabled,
              pressed && hasPhone && styles.cardPressed
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("support.callButton")}
            accessibilityState={{ disabled: !hasPhone }}
          >
            <View style={[styles.iconWrap, styles.iconPhone]}>
              <Ionicons name="call-outline" size={28} color={mobileColors.accent} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{t("support.callButton")}</Text>
              <Text style={styles.cardHint}>
                {hasPhone ? t("support.callHint") : t("support.phoneUnavailable")}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={hasPhone ? mobileColors.textSecondary : mobileColors.border}
            />
          </Pressable>

          <Pressable
            onPress={() => void onTelegram()}
            disabled={!hasTelegram}
            style={({ pressed }) => [
              styles.card,
              !hasTelegram && styles.cardDisabled,
              pressed && hasTelegram && styles.cardPressed
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("support.telegramButton")}
            accessibilityState={{ disabled: !hasTelegram }}
          >
            <View style={[styles.iconWrap, styles.iconTelegram]}>
              <Ionicons
                name="paper-plane-outline"
                size={26}
                color="#229ED9"
              />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{t("support.telegramButton")}</Text>
              <Text style={styles.cardHint}>
                {hasTelegram
                  ? t("support.telegramHint")
                  : t("support.telegramUnavailable")}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={
                hasTelegram ? mobileColors.textSecondary : mobileColors.border
              }
            />
          </Pressable>
        </View>
      </ScrollView>
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.lg
  },
  lead: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    lineHeight: 22
  },
  emptyBox: {
    padding: mobileSpacing.md,
    borderRadius: 12,
    backgroundColor: mobileColors.surfaceMuted,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  emptyText: {
    fontSize: 14,
    color: mobileColors.textSecondary,
    lineHeight: 20
  },
  actions: {
    gap: mobileSpacing.md
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    padding: mobileSpacing.lg,
    borderRadius: 16,
    backgroundColor: mobileColors.background,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  cardPressed: {
    opacity: 0.92
  },
  cardDisabled: {
    opacity: 0.55
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  iconPhone: {
    backgroundColor: `${mobileColors.accent}18`
  },
  iconTelegram: {
    backgroundColor: "#229ED918"
  },
  cardBody: {
    flex: 1,
    gap: 4
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  cardHint: {
    fontSize: 13,
    color: mobileColors.textSecondary,
    lineHeight: 18
  }
});
