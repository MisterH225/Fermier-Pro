import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import i18n from "../../i18n/i18n";
import { type AppLocaleCode, setStoredAppLocale } from "../../lib/appLocale";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { Card } from "../ui/Card";
import { ActiveProfileSwitcherControl } from "./ActiveProfileSwitcherControl";
import { NotificationSettingsRow } from "./NotificationSettingsRow";

const LOCALE_CODES: AppLocaleCode[] = ["fr", "en"];

type AccountSettingsPanelProps = {
  /** Avant une navigation stack (ex. fermer la modal producteur). */
  onBeforeNavigate?: () => void;
  /** Masque la carte identité (ex. modal producteur : nom déjà édité au-dessus). */
  compact?: boolean;
  /** Masque le bloc langue (ex. sélecteur pastille dans le modal producteur). */
  hideLanguagePicker?: boolean;
  /** Masque le changement de profil (ex. déplacé sous l’avatar dans le modal producteur). */
  hideActiveProfileSwitcher?: boolean;
};

export function AccountSettingsPanel({
  onBeforeNavigate,
  compact = false,
  hideLanguagePicker = false,
  hideActiveProfileSwitcher = false
}: AccountSettingsPanelProps) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authMe, signOut, reloadAuth } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  const user = authMe?.user;
  const currentLng = (i18n.resolvedLanguage ?? i18n.language).split(
    "-"
  )[0] as AppLocaleCode;

  const onPickLocale = async (code: AppLocaleCode) => {
    await setStoredAppLocale(code);
    await i18n.changeLanguage(code);
  };

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const goHelp = () => {
    onBeforeNavigate?.();
    navigation.navigate("ModuleRoadmap", {
      title: t("account.helpTitle"),
      body: t("account.helpBody")
    });
  };

  return (
    <View style={styles.wrap}>
      {!compact ? (
        <Card>
          <Text style={styles.sectionLabel}>{t("account.identity")}</Text>
          {user?.fullName ? (
            <Text style={styles.name}>{user.fullName}</Text>
          ) : (
            <Text style={styles.nameMuted}>{t("account.noName")}</Text>
          )}
          {user?.email ? <Text style={styles.meta}>{user.email}</Text> : null}
          {user?.phone ? <Text style={styles.meta}>{user.phone}</Text> : null}
          {!user?.email && !user?.phone ? (
            <Text style={styles.meta}>{t("account.linkedAccount")}</Text>
          ) : null}
        </Card>
      ) : null}

      {!hideActiveProfileSwitcher ? (
        <>
          <Text style={styles.sectionLabel}>{t("account.activeProfile")}</Text>
          <ActiveProfileSwitcherControl variant="default" />
        </>
      ) : null}

      {!hideLanguagePicker ? (
        <Card>
          <Text style={styles.sectionLabel}>{t("account.language")}</Text>
          {LOCALE_CODES.map((code) => {
            const selected = code === currentLng;
            const label = code === "fr" ? "Français" : "English";
            return (
              <Pressable
                key={code}
                style={[styles.localeRow, selected && styles.localeRowOn]}
                onPress={() => void onPickLocale(code)}
              >
                <View style={styles.localeText}>
                  <Text
                    style={[
                      styles.localeTitle,
                      selected && styles.localeTitleOn
                    ]}
                  >
                    {label}
                  </Text>
                  <Text style={styles.localeHint}>
                    {t(`account.localeHints.${code}`)}
                  </Text>
                </View>
                {selected ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          })}
          <Text style={styles.hint}>{t("account.languagePersistHint")}</Text>
        </Card>
      ) : null}

      <NotificationSettingsRow />

      <Pressable style={styles.secondaryRow} onPress={goHelp}>
        <Text style={styles.secondaryLabel}>{t("account.help")}</Text>
        <Text style={styles.secondaryChevron}>›</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryRow}
        onPress={() => void reloadAuth()}
      >
        <Text style={styles.secondaryLabel}>{t("account.refresh")}</Text>
        <Text style={styles.secondaryChevron}>›</Text>
      </Pressable>

      <Pressable
        style={[styles.signOutBtn, signingOut && styles.signOutDisabled]}
        onPress={() => void onSignOut()}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator color={mobileColors.error} />
        ) : (
          <Text style={styles.signOutLabel}>{t("account.signOut")}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: mobileSpacing.lg
  },
  sectionLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginLeft: 4
  },
  name: {
    ...mobileTypography.title,
    fontSize: 20,
    color: mobileColors.textPrimary,
    marginBottom: 4
  },
  nameMuted: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  meta: {
    ...mobileTypography.body,
    fontSize: 14,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  hint: {
    ...mobileTypography.meta,
    fontSize: 12,
    lineHeight: 17,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.md
  },
  localeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    marginBottom: mobileSpacing.sm
  },
  localeRowOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  localeText: {
    flex: 1,
    paddingRight: mobileSpacing.md
  },
  localeTitle: {
    ...mobileTypography.cardTitle,
    fontSize: 16,
    color: mobileColors.textPrimary
  },
  localeTitleOn: {
    color: mobileColors.accent
  },
  localeHint: {
    ...mobileTypography.meta,
    marginTop: 2,
    color: mobileColors.textSecondary
  },
  check: {
    fontSize: 18,
    fontWeight: "700",
    color: mobileColors.accent
  },
  secondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: mobileSpacing.lg,
    paddingHorizontal: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  secondaryLabel: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  secondaryChevron: {
    fontSize: 22,
    color: mobileColors.textSecondary
  },
  signOutBtn: {
    minHeight: 52,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: mobileSpacing.xl,
    backgroundColor: mobileColors.background
  },
  signOutDisabled: {
    opacity: 0.55
  },
  signOutLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.error
  }
});
