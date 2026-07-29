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
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { Card } from "../ui/Card";
import { ActiveProfileSwitcherControl } from "./ActiveProfileSwitcherControl";
import { DangerZone } from "../profile/DangerZone";
import { ProfileSensitiveZone } from "../profile/ProfileSensitiveZone";
import { NotificationSettingsRow } from "./NotificationSettingsRow";

const LOCALE_CODES: AppLocaleCode[] = ["fr", "en"];

/** Affiche `+225 07 ** ** ** **` : code pays + 2 premiers chiffres + étoiles. */
function maskPhoneDisplay(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 4) return "***";
  const cc = digits.slice(0, 3);
  const head = digits.slice(3, 5);
  const tail = digits.slice(5);
  const masked = tail.replace(/\d/g, "*").replace(/(.{2})/g, "$1 ").trim();
  return `+${cc} ${head} ${masked}`.trim();
}

type AccountSettingsPanelProps = {
  /** Avant une navigation stack (ex. fermer la modal producteur). */
  onBeforeNavigate?: () => void;
  /** Masque la carte identité (ex. modal producteur : nom déjà édité au-dessus). */
  compact?: boolean;
  /** Masque le bloc langue (ex. sélecteur pastille dans le modal producteur). */
  hideLanguagePicker?: boolean;
  /** Masque le changement de profil (ex. déplacé sous l’avatar dans le modal producteur). */
  hideActiveProfileSwitcher?: boolean;
  /**
   * Socle Paramètres : identité + profil actif uniquement.
   * Langue, notifications, déconnexion et suppression sont gérés à part
   * via SettingsSection / SettingsRow / NotificationSettingsRow.
   */
  accountOnly?: boolean;
};

export function AccountSettingsPanel({
  onBeforeNavigate,
  compact = false,
  hideLanguagePicker = false,
  hideActiveProfileSwitcher = false,
  accountOnly = false
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

  const goSupport = () => {
    onBeforeNavigate?.();
    navigation.navigate("Support");
  };

  const goAddPhone = () => {
    onBeforeNavigate?.();
    navigation.navigate("AddPhone");
  };

  const phoneBlock = (
    <>
      <Text
        style={[
          styles.sectionLabel,
          !compact ? styles.phoneSectionLabel : undefined
        ]}
      >
        {t("addPhone.sectionTitle")}
      </Text>
      {user?.phone ? (
        <>
          <Text style={styles.meta}>{maskPhoneDisplay(user.phone)}</Text>
          <Text style={styles.phoneHint}>{t("addPhone.maskedHint")}</Text>
        </>
      ) : (
        <Pressable
          style={styles.addPhoneBtn}
          onPress={goAddPhone}
          accessibilityRole="button"
          accessibilityLabel={t("addPhone.addButton")}
        >
          <Text style={styles.addPhoneBtnLabel}>{t("addPhone.addButton")}</Text>
        </Pressable>
      )}
    </>
  );

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
          {!user?.email && !user?.phone ? (
            <Text style={styles.meta}>{t("account.linkedAccount")}</Text>
          ) : null}
          {phoneBlock}
        </Card>
      ) : (
        <Card>{phoneBlock}</Card>
      )}

      {!hideActiveProfileSwitcher ? (
        <>
          <Text style={styles.sectionLabel}>{t("account.activeProfile")}</Text>
          <ActiveProfileSwitcherControl variant="default" />
        </>
      ) : null}

      {accountOnly ? null : (
        <>
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

          <Pressable style={styles.secondaryRow} onPress={goSupport}>
            <Text style={styles.secondaryLabel}>{t("support.title")}</Text>
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

          <ProfileSensitiveZone />
          <DangerZone />
        </>
      )}

      {accountOnly ? <ProfileSensitiveZone /> : null}
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
    fontSize: mobileFontSize.xl,
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
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  phoneSectionLabel: {
    marginTop: mobileSpacing.lg,
    marginBottom: mobileSpacing.xs
  },
  phoneHint: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  addPhoneBtn: {
    marginTop: mobileSpacing.xs,
    minHeight: 44,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: mobileSpacing.md
  },
  addPhoneBtnLabel: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.accent
  },
  hint: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
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
    fontSize: mobileFontSize.lg,
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
    fontSize: mobileFontSize.lg,
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
    fontSize: mobileFontSize.xl,
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
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: mobileColors.error
  }
});
